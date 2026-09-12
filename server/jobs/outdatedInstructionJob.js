import instructionManager from '../services/instruction/ManagementOfInstruction.js';
import config from '../config/config.js';

let intervalId = null;

export function startOutdatedInstructionJob() {
  if (intervalId) return;

  console.log('[CTS Jobs] Starting Outdated Instruction Background Worker (interval: 60s, threshold: 24h)...');

  // Run on start
  instructionManager.sweepOutdatedInstructions(24).catch(err => {
    console.error('[CTS Jobs] Error in initial outdated sweep:', err);
  });

  intervalId = setInterval(async () => {
    try {
      const expired = await instructionManager.sweepOutdatedInstructions(24);
      if (expired.length > 0) {
        console.log(`[CTS Jobs] Swept and expired ${expired.length} outdated instruction(s).`);
      }
    } catch (err) {
      console.error('[CTS Jobs] Error running outdated instruction sweep:', err);
    }
  }, config.outdatedSweepIntervalMs);
}

export function stopOutdatedInstructionJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
