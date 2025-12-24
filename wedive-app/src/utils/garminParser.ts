import JSZip from 'jszip';
import { Buffer } from 'buffer';
// @ts-ignore
import FitParser from 'fit-file-parser';
import Papa from 'papaparse';
import { DiveLog } from '../types';

// Global Buffer shim for fit-file-parser if needed
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer as any;
}

export interface ParsedLog extends Partial<DiveLog> {
  // Extra fields for UI mapping
  originalDate?: string;
  originalTime?: string;
  originalDepth?: string;
  originalPoint?: string;
  originalActivityId?: string;
  hasProfileData?: boolean;
  sourceType?: 'csv' | 'zip';
}

export interface ParseResult {
  logs: ParsedLog[];
  debugLogs: string[];
}

/**
 * CSV parser for Garmin (Simple Import)
 */
export const parseGarminCsv = (csvContent: string): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const logs: ParsedLog[] = results.data.map((row: any) => {
          let dateStr = row['Date'] || row['date'] || row['Start Date'] || '';
          let timeStr = row['Time'] || row['time'] || row['Start Time'] || '';

          const garminDate = row['日付'];
          if (garminDate) {
            const parts = garminDate.split(' ');
            if (parts.length >= 1) dateStr = parts[0];
            if (parts.length >= 2) timeStr = parts[1];
          }

          const titleStr = row['タイトル'] || row['Title'] || '';
          const durationStr = row['ダイブ時間'] || row['Duration'] || row['Dive Time'] || '';
          const maxDepthStr = row['最大深度'] || row['Max Depth'] || row['depth'] || '';
          const avgDepthStr = row['Avg Depth'] || '';
          const tempStr = row['最低水温'] || row['Water Temp'] || '';

          const parseDurationLocal = (str: string): number => {
            if (!str) return 0;
            const parts = str.split(':').map(Number);
            if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
            if (parts.length === 2) return parts[0] + parts[1] / 60;
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
          };

          const duration = parseDurationLocal(durationStr);
          const maxDepth = parseFloat(maxDepthStr.toString().match(/(\d+(\.\d+)?)/)?.[0] || '0');
          const avgDepth = parseFloat(avgDepthStr.toString().match(/(\d+(\.\d+)?)/)?.[0] || '0');

          return {
            date: dateStr,
            title: titleStr,
            time: { entry: timeStr, exit: '', duration: Math.round(duration) },
            depth: { max: maxDepth, average: avgDepth },
            condition: { waterTemp: { bottom: tempStr ? parseFloat(tempStr) : undefined } },
            location: { pointId: '', pointName: titleStr || 'Imported Log', region: '' },
            sourceType: 'csv',
            originalDate: dateStr,
            originalTime: timeStr,
            originalDepth: `${maxDepth}m`,
            originalPoint: titleStr
          };
        });
        resolve({ logs, debugLogs: [] });
      },
      error: (error: any) => reject(error)
    });
  });
};

/**
 * ZIP parser for Garmin (Detailed Import)
 */
export const parseGarminZip = async (fileData: ArrayBuffer, options: { skipFit?: boolean } = {}): Promise<ParseResult> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(fileData);
  const logs: ParsedLog[] = [];
  const debugLogs: string[] = [];
  const { skipFit } = options;

  const logDebug = (msg: string) => {
    debugLogs.push(msg);
    console.log(msg);
  };

  const files = Object.keys(loadedZip.files);
  logDebug(`Total files in ZIP: ${files.length}`);

  const diveJsonFiles = files.filter(path =>
    path.match(/DI_CONNECT\/DI-DIVE\/Dive-ACTIVITY\d+\.json$/i) ||
    path.match(/^Dive-ACTIVITY\d+\.json$/i)
  );

  const fitDataMap = new Map<number, any[]>();

  if (!skipFit) {
    const nestedZips = files.filter(path => path.toLowerCase().endsWith('.zip'));
    const fitFiles = files.filter(path => path.match(/\.fit$/i));

    for (const zipPath of nestedZips) {
      try {
        const zipData = await loadedZip.files[zipPath].async('arraybuffer');
        const innerZip = await new JSZip().loadAsync(zipData);
        const innerFits = Object.keys(innerZip.files).filter(f => f.match(/\.fit$/i));

        for (const innerPath of innerFits) {
          try {
            const fitBuf = await innerZip.files[innerPath].async('arraybuffer');
            const records = await parseFitFileSimple(fitBuf);
            if (records && records.length > 0) {
              fitDataMap.set(records[0].timestamp.getTime(), records);
            }
          } catch (e) { }
        }
      } catch (err) { }
    }

    for (const path of fitFiles) {
      try {
        const arrayBuffer = await loadedZip.files[path].async('arraybuffer');
        const records = await parseFitFileSimple(arrayBuffer);
        if (records && records.length > 0) {
          fitDataMap.set(records[0].timestamp.getTime(), records);
        }
      } catch (err) { }
    }
  }

  for (const path of diveJsonFiles) {
    try {
      const content = await loadedZip.files[path].async('string');
      const json = JSON.parse(content);
      const parsed = mapGarminJsonToLog(json);

      if (parsed) {
        if (fitDataMap.size > 0 && parsed.date && parsed.time?.entry) {
          const logTs = new Date(`${parsed.date}T${parsed.time.entry}`).getTime();
          let bestMatchTs = -1;
          let minDiff = 24 * 60 * 60 * 1000;
          const MAX_TOLERANCE = 60 * 60 * 1000;

          for (const fitTs of fitDataMap.keys()) {
            const diff = Math.abs(fitTs - logTs);
            if (diff < minDiff) { minDiff = diff; bestMatchTs = fitTs; }
          }

          if (minDiff <= MAX_TOLERANCE && bestMatchTs !== -1) {
            const records = fitDataMap.get(bestMatchTs);
            if (records) {
              parsed.profile = records.map((r: any) => ({
                time: Math.round((r.timestamp.getTime() - bestMatchTs) / 1000),
                depth: (r.depth || 0) / 1000,
                temp: r.temperature,
                hr: r.heart_rate
              }));
              parsed.hasProfileData = true;
            }
          }
        }
        parsed.sourceType = 'zip';
        logs.push(parsed);
      }
    } catch (err) { }
  }

  return {
    logs: logs.sort((a, b) => (new Date(b.date || '').getTime() - new Date(a.date || '').getTime())),
    debugLogs
  };
};

const parseFitFileSimple = (buffer: ArrayBuffer): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true, mode: 'list' });
    parser.parse(Buffer.from(buffer), (error: any, data: any) => {
      if (error) reject(error);
      else resolve(data?.records || []);
    });
  });
};

const mapGarminJsonToLog = (json: any): ParsedLog | null => {
  if (json.data && json.type === 'ACTIVITY') return mapGarminJsonDataToLog(json.data);
  if (!json?.startTime) return null;

  const startTime = new Date(json.startTime);
  const dateStr = json.startTime.split('T')[0];
  const timeStr = startTime.toTimeString().split(' ')[0].substring(0, 5);
  const durationMin = Math.round((json.totalTime || 0) / 60);

  const gas = json.equipment?.gases?.[0];
  const tankData: any = {};
  if (gas) {
    if (gas.tankType === 'STEEL') tankData.material = 'steel';
    if (gas.tankType === 'ALUMINUM') tankData.material = 'aluminum';
    if (gas.tankSize) tankData.capacity = Math.round(gas.tankSize);
    if (gas.startPressure) tankData.pressureStart = Math.round(gas.startPressure);
    if (gas.endPressure) tankData.pressureEnd = Math.round(gas.endPressure);
    if (gas.gasType) tankData.gasType = gas.gasType;
  }

  return {
    date: dateStr,
    title: json.name || json.activityName || 'Garmin Dive',
    time: { entry: timeStr, exit: '', duration: durationMin },
    depth: { max: json.profile?.maxDepth || 0, average: json.profile?.averageDepth || 0 },
    condition: { waterTemp: { bottom: json.environment?.minTemperature || json.environment?.avgTemperature || undefined } },
    location: { pointId: '', pointName: json.name || json.activityName || 'Garmin Dive', region: '', lat: json.location?.exitLoc?.latitude, lng: json.location?.exitLoc?.longitude },
    gear: { tank: tankData, suitType: 'wet' }
  };
};

const mapGarminJsonDataToLog = (data: any): ParsedLog => {
  const startTime = new Date(data.startTime);
  const dateStr = data.startTime.split('T')[0];
  const timeStr = startTime.toTimeString().split(' ')[0].substring(0, 5);
  const durationMin = Math.round((data.totalTime || 0) / 60);

  const gas = data.equipment?.gases?.[0];
  const tankData: any = {};
  if (gas) {
    if (gas.tankType === 'STEEL') tankData.material = 'steel';
    if (gas.tankType === 'ALUMINUM') tankData.material = 'aluminum';
    if (gas.tankSize) tankData.capacity = Math.round(gas.tankSize);
    if (gas.startPressure) tankData.pressureStart = Math.round(gas.startPressure);
    if (gas.endPressure) tankData.pressureEnd = Math.round(gas.endPressure);
  }

  return {
    date: dateStr,
    title: data.name || 'Garmin Dive',
    time: { entry: timeStr, exit: '', duration: durationMin },
    depth: { max: data.profile?.maxDepth || 0, average: data.profile?.averageDepth || 0 },
    condition: { waterTemp: { bottom: data.environment?.minTemperature }, waterType: data.environment?.waterType === 'SALT' ? 'salt' : 'fresh' },
    location: { pointId: '', pointName: data.name || 'Garmin Dive', region: '', lat: data.location?.entryLoc?.latitude, lng: data.location?.entryLoc?.longitude },
    comment: data.notes || '',
    gear: { tank: tankData, suitType: 'wet' }
  };
};
