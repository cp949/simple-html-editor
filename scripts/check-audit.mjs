import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const severities = ['info', 'low', 'moderate', 'high', 'critical'];

function auditFailureDetails(result) {
  const status = result.status === null ? `signal ${result.signal ?? 'unknown'}` : result.status;
  const stderr = result.stderr.trim() || '(stderr 없음)';
  return `status ${status}; stderr: ${stderr}`;
}

export function assertAuditReport(report, label) {
  const vulnerabilities = report?.metadata?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object') {
    throw new Error(`Invalid ${label} audit report`);
  }

  const present = severities.filter((severity) => {
    const count = vulnerabilities[severity];
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid ${label} audit report: ${severity} count is missing or invalid`);
    }
    return count > 0;
  });
  if (present.length > 0) {
    throw new Error(
      `${label} audit vulnerabilities: ${present
        .map((severity) => `${severity}=${vulnerabilities[severity]}`)
        .join(', ')}`,
    );
  }
}

export function runAudit(mode) {
  const args = ['audit'];
  if (mode === 'prod') args.push('--prod');
  args.push('--audit-level', 'low', '--json');

  const result = spawnSync('pnpm', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`pnpm audit could not run: ${result.error.message}`);
  }

  const label = mode === 'prod' ? 'production' : 'full';
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `Invalid ${label} audit JSON (${auditFailureDetails(result)}): ${error.message}`,
    );
  }

  try {
    assertAuditReport(report, label);
  } catch (error) {
    if (error.message.startsWith(`${label} audit vulnerabilities:`)) {
      throw error;
    }
    throw new Error(`${error.message} (${auditFailureDetails(result)})`);
  }
  if (result.status !== 0) {
    throw new Error(`pnpm audit failed with ${auditFailureDetails(result)}`);
  }
  console.log(`${label === 'production' ? 'Production' : 'Full'} dependency audit passed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode !== '--prod' && mode !== '--full') {
    throw new Error('Usage: check-audit.mjs --prod|--full');
  }
  runAudit(mode.slice(2));
}
