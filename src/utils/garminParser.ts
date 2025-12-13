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

export const parseGarminZip = async (file: any): Promise<ParsedLog[]> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const logs: ParsedLog[] = [];

  // Iterate over files in the zip
  const files = Object.keys(loadedZip.files);

  // 1. Find JSON files (Metadata)
  // Structure based on analysis: DI_CONNECT/DI-DIVE/Dive-ACTIVITY*.json
  const diveJsonFiles = files.filter(path =>
    path.match(/DI_CONNECT\/DI-DIVE\/Dive-ACTIVITY\d+\.json$/i) ||
    path.match(/^Dive-ACTIVITY\d+\.json$/i) // Allow flat zip too
  );

  // 2. Find FIT files (Profile Data)
  // Usually in DI_CONNECT/DI-DIVE/Uploaded/ or just *.fit
  const fitFiles = files.filter(path => path.match(/\.fit$/i));

  console.log(`Found ${diveJsonFiles.length} Garmin dive logs and ${fitFiles.length} FIT files.`);

  // Parse all FIT files first to index them by startTime
  const fitDataMap = new Map<number, any[]>(); // startTime (ms) -> records

  for (const path of fitFiles) {
    try {
      const arrayBuffer = await loadedZip.files[path].async('arraybuffer');
      const records = await parseFitFileSimple(arrayBuffer);
      if (records && records.length > 0) {
        // Use the timestamp of the first record (or session start)
        const startTs = records[0].timestamp.getTime(); // Approximate
        fitDataMap.set(startTs, records);
      }
    } catch (err) {
      console.warn(`Failed to parse FIT file ${path}`, err);
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

          // Find closest FIT start time within 5 minutes tolerance
          let bestMatchTs = -1;
          let minDiff = 5 * 60 * 1000; // 5 mins

          for (const fitTs of fitDataMap.keys()) {
            const diff = Math.abs(fitTs - logTs);
            if (diff < minDiff) {
              minDiff = diff;
              bestMatchTs = fitTs;
            }
          }

          if (bestMatchTs !== -1) {
            const records = fitDataMap.get(bestMatchTs);
            if (records) {
              // Map FIT records to Log.profile
              parsed.profile = records.map((r: any) => ({
                time: Math.round((r.timestamp.getTime() - bestMatchTs) / 1000), // seconds from start
                depth: r.depth,
                temp: r.temperature,
                hr: r.heart_rate
              }));
              parsed.hasProfileData = true;
              // Update max depth/avg if needed from FIT (often more accurate)
              // But JSON summary is usually fine.
            }
          }
        }
        logs.push(parsed);
      }
    } catch (err) {
      console.warn(`Failed to parse ${path}`, err);
    }
  }

  return logs.sort((a, b) => {
    // Sort by date desc
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });
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
  const dateStr = startTime.toISOString().split('T')[0];

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

  const dateStr = startTime.toISOString().split('T')[0];
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
    garminActivityId: String(data.id),
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
