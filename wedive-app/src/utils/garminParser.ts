import JSZip from 'jszip';
import { Buffer } from 'buffer';
// @ts-ignore
import FitParser from 'fit-file-parser';
import Papa from 'papaparse';
import { DiveLog } from '../types';

// Global Buffer shim for fit-file-parser
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
 * ZIP parser for Garmin (Ported from WeDive-Web)
 */
export interface ParseOptions {
  skipFit?: boolean;
  onProgress?: (message: string) => void;
}

export const parseGarminZip = async (fileData: any, options: ParseOptions = {}): Promise<ParseResult> => {
  const { skipFit, onProgress } = options;
  const logDebug = (msg: string) => onProgress?.(msg);

  const zip = new JSZip();
  // In mobile, fileData is usually base64 string or ArrayBuffer
  const isBase64 = typeof fileData === 'string';
  const loadedZip = await zip.loadAsync(fileData, { base64: isBase64 });
  const logs: ParsedLog[] = [];
  const debugLogs: string[] = [];

  const files = Object.keys(loadedZip.files);
  logDebug(`ZIP内のファイル数: ${files.length}`);

  // 1. JSONファイルを特定 (DI_CONNECT/DI-DIVE/Dive-ACTIVITY*.json)
  const diveJsonFiles = files.filter(path =>
    path.match(/DI_CONNECT\/DI-DIVE\/Dive-ACTIVITY\d+\.json$/i) ||
    path.match(/^Dive-ACTIVITY\d+\.json$/i)
  );

  // 2. FITファイルを特定
  const fitFiles = files.filter(path => path.match(/\.fit$/i));
  const nestedZips = files.filter(path => path.toLowerCase().endsWith('.zip'));

  logDebug(`初期スキャン: ${fitFiles.length}個のFITファイル, ${nestedZips.length}個の入れ子ZIP。`);

  const fitDataMap = new Map<number, any[]>();

  if (!skipFit) {
    // 入れ子ZIPの展開
    for (const zipPath of nestedZips) {
      try {
        logDebug(`入れ子ZIPを展開中: ${zipPath}`);
        const zipData = await loadedZip.files[zipPath].async('arraybuffer');
        const innerZip = await new JSZip().loadAsync(zipData);
        const innerFiles = Object.keys(innerZip.files).filter(f => f.match(/\.fit$/i));

        for (const innerPath of innerFiles) {
          try {
            const fitBuf = await innerZip.files[innerPath].async('arraybuffer');
            const records = await parseFitFileSimple(fitBuf);
            if (records && records.length > 0) {
              const startTs = records[0].timestamp.getTime();
              fitDataMap.set(startTs, records);
            }
          } catch { }
        }
      } catch (err) {
        logDebug(`入れ子ZIP ${zipPath} の展開に失敗: ${err}`);
      }
    }

    // ルートレベルのFITファイルの解析
    for (const path of fitFiles) {
      try {
        const arrayBuffer = await loadedZip.files[path].async('arraybuffer');
        const records = await parseFitFileSimple(arrayBuffer);
        if (records && records.length > 0) {
          const startTs = records[0].timestamp.getTime();
          fitDataMap.set(startTs, records);
        }
      } catch (err) {
        logDebug(`FITファイル ${path} の解析に失敗: ${err}`);
      }
    }
  }

  // JSONデータの処理
  let count = 0;
  for (const path of diveJsonFiles) {
    count++;
    if (count % 5 === 0 || count === diveJsonFiles.length) {
      logDebug(`解析中 (${count}/${diveJsonFiles.length}件)...`);
    }

    try {
      const content = await loadedZip.files[path].async('string');
      const json = JSON.parse(content);
      const parsed = mapGarminJsonToLog(json);

      if (parsed) {
        // FITデータとの紐付け (時差を考慮して1時間以内の誤差を許容)
        if (fitDataMap.size > 0 && parsed.date && parsed.time?.entry) {
          const logDate = new Date(`${parsed.date}T${parsed.time.entry}`);
          const logTs = logDate.getTime();

          let bestMatchTs = -1;
          let minDiff = 24 * 60 * 60 * 1000;
          const MAX_TOLERANCE = 60 * 60 * 1000; // 1時間

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
        logs.push(parsed);
      }
    } catch (err) {
      logDebug(`JSON ${path} の解析に失敗: ${err}`);
    }
  }

  logDebug('解析完了');
  return {
    logs: logs.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    }),
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
  // Check for wrapped structure
  if (json.data && json.type === 'ACTIVITY') return mapGarminJsonDataToLog(json.data);
  if (!json?.startTime) return null;

  const activityName = json.name || json.activityName || 'Garmin Dive';
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
    title: activityName,
    garminActivityId: String(json.activityId || json.data?.id || ''),
    diveNumber: json.diveNumber || json.diveNo || json.number || 0,
    time: {
      entry: timeStr,
      exit: '',
      duration: durationMin,
      surfaceInterval: json.profile?.surfaceInterval ? Math.round(json.profile.surfaceInterval / 60) : undefined
    },
    depth: { max: json.profile?.maxDepth || 0, average: json.profile?.averageDepth || 0 },
    condition: { waterTemp: { bottom: json.environment?.minTemperature || json.environment?.avgTemperature || undefined } },
    location: {
      pointId: '',
      pointName: activityName,
      region: '',
      lat: json.location?.exitLoc?.latitude || json.location?.startLoc?.latitude,
      lng: json.location?.exitLoc?.longitude || json.location?.startLoc?.longitude
    },
    gear: { tank: tankData, suitType: 'wet' },
    originalDate: dateStr,
    originalTime: timeStr,
    originalDepth: `${json.profile?.maxDepth || 0}m`,
    originalPoint: activityName,
    originalActivityId: String(json.activityId || json.data?.id || '')
  };
};

const mapGarminJsonDataToLog = (data: any): ParsedLog => {
  const startTimeStr = data.startTime;
  const startTime = new Date(startTimeStr);
  const dateStr = typeof startTimeStr === 'string' ? startTimeStr.split('T')[0] : startTime.toISOString().split('T')[0];
  const timeStr = startTime.toTimeString().split(' ')[0].substring(0, 5);
  const activityName = data.name || 'Garmin Dive';

  const totalTime = data.totalTime || 0;
  const durationMin = Math.round(totalTime / 60);
  const exitTime = new Date(startTime.getTime() + totalTime * 1000);
  const exitTimeStr = exitTime.toTimeString().split(' ')[0].substring(0, 5);

  const gas = data.equipment?.gases?.[0];
  const tankData: any = {};
  if (gas) {
    if (gas.tankType === 'STEEL') tankData.material = 'steel';
    if (gas.tankType === 'ALUMINUM') tankData.material = 'aluminum';
    if (gas.tankSize) tankData.capacity = Math.round(gas.tankSize);
    if (gas.startPressure) tankData.pressureStart = Math.round(gas.startPressure);
    if (gas.endPressure) tankData.pressureEnd = Math.round(gas.endPressure);
    tankData.gasType = gas.gasType;
  }

  return {
    date: dateStr,
    title: activityName,
    garminActivityId: String(data.connectActivityId || data.activityId || data.id),
    diveNumber: data.number || data.diveNumber || 0,
    time: {
      entry: timeStr,
      exit: exitTimeStr,
      duration: durationMin,
      surfaceInterval: data.profile?.surfaceInterval ? Math.round(data.profile.surfaceInterval / 60) : 0
    },
    depth: { max: data.profile?.maxDepth || 0, average: data.profile?.averageDepth || 0 },
    condition: {
      waterTemp: {
        bottom: data.environment?.minTemperature,
        surface: data.environment?.maxTemperature
      }
    },
    location: {
      pointId: '',
      pointName: activityName,
      region: '',
      lat: data.location?.entryLoc?.latitude,
      lng: data.location?.entryLoc?.longitude
    },
    comment: data.notes || '',
    gear: { tank: tankData, suitType: 'wet' },
    originalDate: dateStr,
    originalTime: timeStr,
    originalDepth: `${data.profile?.maxDepth || 0}m`,
    originalPoint: activityName,
    originalActivityId: String(data.id)
  };
};
