import JSZip from 'jszip';
import { Buffer } from 'buffer';
// @ts-ignore
import FitParser from 'fit-file-parser';
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
}

export interface ParseResult {
  logs: ParsedLog[];
  debugLogs: string[];
}

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

  // Find JSON files (Metadata)
  const diveJsonFiles = files.filter(path =>
    path.match(/DI_CONNECT\/DI-DIVE\/Dive-ACTIVITY\d+\.json$/i) ||
    path.match(/^Dive-ACTIVITY\d+\.json$/i)
  );

  // Find FIT files (Profile Data)
  const fitFiles = files.filter(path => path.match(/\.fit$/i));

  // Check for nested ZIPs
  const nestedZips = files.filter(path => path.toLowerCase().endsWith('.zip'));

  const fitDataMap = new Map<number, any[]>();

  if (!skipFit) {
    // Unpack nested ZIPs
    for (const zipPath of nestedZips) {
      try {
        const zipData = await loadedZip.files[zipPath].async('arraybuffer');
        const innerZip = await new JSZip().loadAsync(zipData);
        const innerFiles = Object.keys(innerZip.files);
        const innerFits = innerFiles.filter(f => f.match(/\.fit$/i));

        for (const innerPath of innerFits) {
          try {
            const fitBuf = await innerZip.files[innerPath].async('arraybuffer');
            const records = await parseFitFileSimple(fitBuf);
            if (records && records.length > 0) {
              const startTs = records[0].timestamp.getTime();
              fitDataMap.set(startTs, records);
            }
          } catch (e) {
            logDebug(`Failed to parse inner FIT: ${innerPath}`);
          }
        }
      } catch (err) {
        logDebug(`Failed to unpack nested ZIP ${zipPath}: ${err}`);
      }
    }

    // Parse top-level FIT files
    for (const path of fitFiles) {
      try {
        const arrayBuffer = await loadedZip.files[path].async('arraybuffer');
        const records = await parseFitFileSimple(arrayBuffer);
        if (records && records.length > 0) {
          const startTs = records[0].timestamp.getTime();
          fitDataMap.set(startTs, records);
        }
      } catch (err) {
        logDebug(`Failed to parse FIT file ${path}: ${err}`);
      }
    }
  }

  for (const path of diveJsonFiles) {
    try {
      const content = await loadedZip.files[path].async('string');
      const json = JSON.parse(content);
      const parsed = mapGarminJsonToLog(json);

      if (parsed) {
        // Try to link FIT data
        if (fitDataMap.size > 0 && parsed.date && parsed.time?.entry) {
          const logDate = new Date(`${parsed.date}T${parsed.time.entry}`);
          const logTs = logDate.getTime();

          let bestMatchTs = -1;
          let minDiff = 24 * 60 * 60 * 1000;
          const MAX_TOLERANCE = 60 * 60 * 1000;

          for (const fitTs of fitDataMap.keys()) {
            const diff = Math.abs(fitTs - logTs);
            if (diff < minDiff) {
              minDiff = diff;
              bestMatchTs = fitTs;
            }
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
      logDebug(`Failed to parse ${path}: ${err}`);
    }
  }

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
    const parser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'list'
    });

    // Provide buffer as a Buffer object for the parser
    const fitBuffer = Buffer.from(buffer);

    parser.parse(fitBuffer, (error: any, data: any) => {
      if (error) {
        reject(error);
      } else {
        if (data && data.records) {
          resolve(data.records);
        } else {
          resolve([]);
        }
      }
    });
  });
};

const mapGarminJsonToLog = (json: any): ParsedLog | null => {
  if (json.data && json.type === 'ACTIVITY') {
    return mapGarminJsonDataToLog(json.data);
  }
  if (!json?.startTime) return null;

  const activityName = json.name || json.activityName || 'Garmin Dive';
  const startTime = new Date(json.startTime);
  const dateStr = json.startTime ? json.startTime.split('T')[0] : startTime.toISOString().split('T')[0];
  const timeStr = startTime.toTimeString().split(' ')[0].substring(0, 5);
  const totalTimeSeconds = json.totalTime || 0;
  const durationMin = Math.round(totalTimeSeconds / 60);

  const maxDepth = json.profile?.maxDepth || 0;
  const avgDepth = json.profile?.averageDepth || 0;
  const waterTemp = json.environment?.minTemperature || json.environment?.avgTemperature || undefined;
  const lat = json.location?.exitLoc?.latitude || json.location?.startLoc?.latitude;
  const lng = json.location?.exitLoc?.longitude || json.location?.startLoc?.longitude;

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
    time: {
      entry: timeStr,
      exit: '',
      duration: durationMin,
      surfaceInterval: json.profile?.surfaceInterval ? Math.round(json.profile.surfaceInterval / 60) : undefined
    },
    depth: {
      max: maxDepth,
      average: avgDepth
    },
    condition: {
      waterTemp: {
        bottom: waterTemp
      }
    },
    location: {
      pointId: '',
      pointName: activityName,
      region: '',
      lat: lat,
      lng: lng
    },
    gear: {
      tank: tankData,
      suitType: 'wet'
    },
    originalDate: dateStr,
    originalTime: timeStr,
    originalDepth: `${maxDepth}m`,
    originalPoint: activityName,
    originalActivityId: String(json.activityId || json.data?.id || ''),
    hasProfileData: false
  };
};

const mapGarminJsonDataToLog = (data: any): ParsedLog => {
  const startTimeIndex = data.startTime;
  const startTime = new Date(startTimeIndex);
  const dateStr = typeof startTimeIndex === 'string' ? startTimeIndex.split('T')[0] : startTime.toISOString().split('T')[0];
  const timeStr = startTime.toTimeString().split(' ')[0].substring(0, 5);
  const activityName = data.name || 'Garmin Dive';
  const totalTime = data.totalTime || 0;
  const durationMin = Math.round(totalTime / 60);
  const exitTime = new Date(startTime.getTime() + totalTime * 1000);
  const exitTimeStr = exitTime.toTimeString().split(' ')[0].substring(0, 5);

  const maxDepth = data.profile?.maxDepth || 0;
  const avgDepth = data.profile?.averageDepth || 0;
  const surfaceInterval = data.profile?.surfaceInterval ? Math.round(data.profile.surfaceInterval / 60) : 0;
  const bottomTemp = data.environment?.minTemperature;

  let waterType: 'salt' | 'fresh' | undefined = undefined;
  if (data.environment?.waterType === 'SALT' || data.environment?.waterType === '1') waterType = 'salt';
  if (data.environment?.waterType === 'FRESH' || data.environment?.waterType === '0') waterType = 'fresh';

  let entryType: 'beach' | 'boat' | undefined = undefined;
  if (data.environment?.entryType === 'SHORE' || data.environment?.entryTypeLegacy === 'Shore') entryType = 'beach';
  if (data.environment?.entryType === 'BOAT' || data.environment?.entryTypeLegacy === 'Boat') entryType = 'boat';

  const gas = data.equipment?.gases?.[0];
  const tankData: any = {};
  if (gas) {
    if (gas.tankType === 'STEEL') tankData.material = 'steel';
    if (gas.tankType === 'ALUMINUM') tankData.material = 'aluminum';
    if (gas.tankSize && gas.tankSizeUnit === 'LITER') tankData.capacity = Math.round(gas.tankSize);
    if (gas.startPressure) tankData.pressureStart = Math.round(gas.startPressure);
    if (gas.endPressure) tankData.pressureEnd = Math.round(gas.endPressure);
    tankData.gasType = gas.gasType;
    if (gas.percentOxygen) tankData.oxygen = gas.percentOxygen;
  }

  return {
    date: dateStr,
    title: activityName,
    garminActivityId: String(data.connectActivityId || data.activityId || data.id),
    time: {
      entry: timeStr,
      exit: exitTimeStr,
      duration: durationMin,
      surfaceInterval: surfaceInterval
    },
    depth: {
      max: maxDepth,
      average: avgDepth
    },
    condition: {
      waterTemp: {
        bottom: bottomTemp,
        surface: data.environment?.maxTemperature
      },
      transparency: data.environment?.visibility,
      waterType: waterType
    },
    location: {
      pointId: '',
      pointName: activityName,
      region: '',
      lat: data.location?.entryLoc?.latitude,
      lng: data.location?.entryLoc?.longitude
    },
    comment: data.notes || '',
    team: {
      buddy: data.buddy
    },
    gear: {
      tank: tankData,
      suitType: 'wet'
    },
    entryType: entryType,
    originalDate: dateStr,
    originalTime: timeStr,
    originalDepth: `${maxDepth}m`,
    originalPoint: activityName,
    originalActivityId: String(data.id),
    hasProfileData: false
  };
};
