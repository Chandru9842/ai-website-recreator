import * as path from 'path';
import * as fs from 'fs';
import { ModificationRecord } from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('HistoryManager');
const HISTORY_FILENAME = '.modifications.json';

export class HistoryManager {
  /**
   * Retrieves the modification history for a project.
   */
  public static getHistory(projectDir: string): ModificationRecord[] {
    const historyPath = path.resolve(projectDir, HISTORY_FILENAME);
    if (!fs.existsSync(historyPath)) {
      return [];
    }

    try {
      const data = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(data) as ModificationRecord[];
    } catch (err: any) {
      logger.warn(`Could not read modification history: ${err.message}`);
      return [];
    }
  }

  /**
   * Records a new modification entry to the project history.
   */
  public static record(projectDir: string, entry: ModificationRecord): void {
    const historyPath = path.resolve(projectDir, HISTORY_FILENAME);
    const history = this.getHistory(projectDir);

    history.push(entry);

    try {
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
      logger.info(`Recorded modification in history: "${entry.instruction}" (${entry.modifiedFiles.length} files)`);
    } catch (err: any) {
      logger.error(`Failed to save modification history: ${err.message}`);
    }
  }
}
