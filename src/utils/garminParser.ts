import JSZip from 'jszip';
import type { Log } from '../types';
// @ts-ignore
import FitParser from 'fit-file-parser';

export interface ParsedLog extends Partial<Log> {
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


export const parseGarminZip = async (file: any, options: { skipFit?: boolean } = {}): Promise<ParseResult> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const logs: ParsedLog[] = [];
  const debugLogs: string[] = [];
  const { skipFit } = options;

  const logDebug = (msg: string) => {
    debugLogs.push(msg);
    console.log(msg);
  };

  // Iterate over files in the zip
  const files = Object.keys(loadedZip.files);

  logDebug(`Total files in ZIP: ${files.length}`);
  logDebug(`First 10 files: ${files.slice(0, 10).join(', ')}`);
  logDebug(`Mode: ${skipFit ? 'Simple (No FIT)' : 'Detailed (With FIT)'}`);

  // Debug: Check if any file looks like a FIT file but missed by regex
  const potentialFit = files.filter(f => f.toLowerCase().includes('fit'));
  if (potentialFit.length > 0) {
    logDebug(`Files containing 'fit' (sample): ${potentialFit.slice(0, 5).join(', ')}`);
  }

  // 1. Find JSON files (Metadata)
  // Structure based on analysis: DI_CONNECT/DI-DIVE/Dive-ACTIVITY*.json
  const diveJsonFiles = files.filter(path =>
    path.match(/DI_CONNECT\/DI-DIVE\/Dive-ACTIVITY\d+\.json$/i) ||
    path.match(/^Dive-ACTIVITY\d+\.json$/i) // Allow flat zip too
  );

  // 2. Find FIT files (Profile Data)
  // Usually in DI_CONNECT/DI-DIVE/Uploaded/ or just *.fit
  // Scan happens but extraction skipped if skipFit=true
  const fitFiles = files.filter(path => path.match(/\.fit$/i));

  // Check for ANY nested ZIPs
  // Garmin exports often contain DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_*.zip
  const nestedZips = files.filter(path => path.toLowerCase().endsWith('.zip'));

  logDebug(`Initial scan: ${fitFiles.length} FIT files, ${nestedZips.length} nested ZIPs.`);
  if (nestedZips.length > 0) {
    logDebug(`Nested ZIPs found: ${nestedZips.join(', ')}`);
  }

  // Parse all FIT files first to index them by startTime
  const fitDataMap = new Map<number, any[]>(); // startTime (ms) -> records

  if (!skipFit) {
    // Unpack nested ZIPs if any
    for (const zipPath of nestedZips) {
      try {
        logDebug(`Unpacking nested ZIP: ${zipPath}`);
        const zipData = await loadedZip.files[zipPath].async('arraybuffer');
        const innerZip = await new JSZip().loadAsync(zipData);

        const innerFiles = Object.keys(innerZip.files);
        const innerFits = innerFiles.filter(f => f.match(/\.fit$/i));
        logDebug(`  -> Found ${innerFits.length} FIT files inside.`);

        for (const innerPath of innerFits) {
          try {
            const fitBuf = await innerZip.files[innerPath].async('arraybuffer');
            const records = await parseFitFileSimple(fitBuf);
            if (records && records.length > 0) {
              const startTs = records[0].timestamp.getTime();
              fitDataMap.set(startTs, records);
              // logDebug(`    -> FIT Parsed: ${innerPath} (Time: ${new Date(startTs).toISOString()})`);
            }
          } catch {
            // logDebug(`Failed inner FIT: ${innerPath}`);
          }
        }
      } catch (err) {
        logDebug(`Failed to unpack nested ZIP ${zipPath}: ${err}`);
      }
    }

    // Parse top-level FIT files (if any existed)
    for (const path of fitFiles) {
      try {
        const arrayBuffer = await loadedZip.files[path].async('arraybuffer');
        const records = await parseFitFileSimple(arrayBuffer);
        if (records && records.length > 0) {
          // Use the timestamp of the first record (or session start)
          const startTs = records[0].timestamp.getTime(); // Approximate
          fitDataMap.set(startTs, records);
          // logDebug(`Parsed FIT: ${path} Start=${new Date(startTs).toISOString()}`);
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

          logDebug(`--- Matching Log: ${parsed.date} ${parsed.time?.entry} (${logTs}) ---`);

          // Find closest FIT start time within WIDER tolerance (e.g. 1 hour)
          let bestMatchTs = -1;
          let minDiff = 24 * 60 * 60 * 1000; // Init high
          let closestDiffMin = 99999;

          const MAX_TOLERANCE = 60 * 60 * 1000; // Increased to 60 mins

          for (const fitTs of fitDataMap.keys()) {
            const diff = Math.abs(fitTs - logTs);
            const diffMin = Math.round(diff / 1000 / 60);

            if (diffMin < closestDiffMin) closestDiffMin = diffMin;

            if (diff < minDiff) {
              minDiff = diff;
              bestMatchTs = fitTs;
            }
          }

          logDebug(`Closest FIT file diff: ${closestDiffMin} min. (Tolerance: ${MAX_TOLERANCE / 60000} min)`);

          if (minDiff <= MAX_TOLERANCE && bestMatchTs !== -1) {
            logDebug(`MATCH FOUND! Linked FIT data (Diff: ${Math.round(minDiff / 1000 / 60)} min)`);
            const records = fitDataMap.get(bestMatchTs);
            if (records) {
              // Map FIT records to Log.profile
              parsed.profile = records.map((r: any) => ({
                time: Math.round((r.timestamp.getTime() - bestMatchTs) / 1000), // seconds from start
                depth: (r.depth || 0) / 1000,
                temp: r.temperature,
                hr: r.heart_rate
              }));
              parsed.hasProfileData = true;
            }
          } else {
            logDebug(`NO MATCH. Closest fit was ${closestDiffMin} min away.`);
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

    parser.parse(buffer, (error: any, data: any) => {
      if (error) {
        reject(error);
      } else {
        // Extract records
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
  // Check for wrapped structure first
  if (json.data && json.type === 'ACTIVITY') {
    return mapGarminJsonDataToLog(json.data);
  }

  // Check essential fields for direct structure
  // "startTime": "2025-09-22T12:43:05+09:00"
  if (!json?.startTime) return null;

  const activityName = json.name || json.activityName || 'Garmin Dive';
  const startTime = new Date(json.startTime);

  // Date YYYY-MM-DD
  // Date YYYY-MM-DD (Parse string directly to avoid UTC shift)
  const dateStr = json.startTime ? json.startTime.split('T')[0] : startTime.toISOString().split('T')[0];

  // Time HH:mm
  const timeStr = startTime.toTimeString().split(' ')[0].substring(0, 5);

  // Duration (seconds) -> Minutes
  const totalTimeSeconds = json.totalTime || 0;
  const durationMin = Math.round(totalTimeSeconds / 60);

  // Depth (meters)
  // json.profile.maxDepth, json.profile.averageDepth
  // Note: Garmin JSON depth is usually meters.
  const maxDepth = json.profile?.maxDepth || 0;
  const avgDepth = json.profile?.averageDepth || 0;

  // Temp (Celsius)
  // json.environment.minTemperature, maxTemperature, avgTemperature
  const waterTemp = json.environment?.minTemperature || json.environment?.avgTemperature || undefined;

  // Location
  const lat = json.location?.exitLoc?.latitude || json.location?.startLoc?.latitude;
  const lng = json.location?.exitLoc?.longitude || json.location?.startLoc?.longitude;

  // Tank/Gas
  // json.equipment.gases[0].gasType ("AIR", etc)
  // json.equipment.gases[0].tankSize (Liters)
  // json.equipment.gases[0].startPressure (BAR)
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

  // Construct Log
  const log: ParsedLog = {
    date: dateStr,
    title: activityName,
    garminActivityId: String(json.activityId || json.data?.id || ''), // Check both locations

    time: {
      entry: timeStr,
      exit: '', // Calculate from duration?
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
      },
      current: json.environment?.waterCurrent === 'NONE' ? 'none' : undefined,
      wave: json.environment?.surfaceCondition === 'FLAT' ? 'none' : undefined,
    },

    location: {
      pointId: '',
      pointName: activityName, // User often names the activity as the point name
      region: '',
      lat: lat,
      lng: lng
    },

    gear: {
      tank: tankData,
      suitType: 'wet', // Default
    },

    // UI Helpers
    originalDate: dateStr,
    originalTime: timeStr,
    originalDepth: `${maxDepth}m`,
    originalPoint: activityName,
    originalActivityId: String(json.activityId || json.data?.id || ''),
    hasProfileData: false // Updated later if FIT found
  };
  return log;
};

// Extracted for clean logic
const mapGarminJsonDataToLog = (data: any): ParsedLog => {
  const startTimeIndex = data.startTime; // "2025-09-22T12:43:05+09:00"
  const startTime = new Date(startTimeIndex);

  // Date YYYY-MM-DD (Parse string directly to avoid UTC shift)
  const dateStr = typeof startTimeIndex === 'string' ? startTimeIndex.split('T')[0] : startTime.toISOString().split('T')[0];
  const timeStr = startTime.toTimeString().split(' ')[0].substring(0, 5);

  const activityName = data.name || 'Garmin Dive';

  // Duration & Exit Time
  const totalTime = data.totalTime || 0; // seconds
  const durationMin = Math.round(totalTime / 60);
  const exitTime = new Date(startTime.getTime() + totalTime * 1000);
  const exitTimeStr = exitTime.toTimeString().split(' ')[0].substring(0, 5);

  // Profile
  const maxDepth = data.profile?.maxDepth || 0;
  const avgDepth = data.profile?.averageDepth || 0;
  const surfaceInterval = data.profile?.surfaceInterval ? Math.round(data.profile.surfaceInterval / 60) : 0;

  // Environment
  const bottomTemp = data.environment?.minTemperature;
  // waterType: 1=SALT?? Garmin usually strings but user sample showed "waterType": "SALT" in one place and 1 in summary.
  // Sample: "waterType":"SALT"
  let waterType: 'salt' | 'fresh' | undefined = undefined;
  if (data.environment?.waterType === 'SALT' || data.environment?.waterType === '1') waterType = 'salt';
  if (data.environment?.waterType === 'FRESH' || data.environment?.waterType === '0') waterType = 'fresh';

  // Entry Type: SHORE -> beach
  let entryType: 'beach' | 'boat' | undefined = undefined;
  if (data.environment?.entryType === 'SHORE' || data.environment?.entryTypeLegacy === 'Shore') entryType = 'beach';
  if (data.environment?.entryType === 'BOAT' || data.environment?.entryTypeLegacy === 'Boat') entryType = 'boat';

  // Tank
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

  // Location (Lat/Lng)
  const lat = data.location?.entryLoc?.latitude;
  const lng = data.location?.entryLoc?.longitude;

  return {
    date: dateStr,
    title: activityName,
    garminActivityId: String(data.connectActivityId || data.activityId || data.id),
    diveNumber: data.number, // "number": 1

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
      current: data.environment?.waterCurrent === 'NONE' || data.environment?.waterCurrent === 'LIGHT' ? 'weak' : 'strong', // Rough mapping
      wave: data.environment?.surfaceCondition === 'FLAT' ? 'none' : undefined,
      transparency: data.environment?.visibility,
      waterType: waterType
    },

    location: {
      pointId: '',
      pointName: activityName,
      region: '',
      lat: lat,
      lng: lng
    },

    // Notes -> Comment
    comment: data.notes || '',

    // Buddy
    team: {
      buddy: data.buddy
    },

    gear: {
      tank: tankData,
      suitType: 'wet'
    },

    entryType: entryType,

    // UI Helpers
    originalDate: dateStr,
    originalTime: timeStr,
    originalDepth: `${maxDepth}m`,
    originalPoint: activityName,
    originalActivityId: String(data.id),
    hasProfileData: false
  };
};
