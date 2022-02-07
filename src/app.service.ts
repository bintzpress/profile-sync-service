import { Injectable, Logger } from '@nestjs/common';
import { ProfileDatabaseManager } from './database.manager';
import { ProfileSynchronizer } from './synchronizer/synchronizer';
import * as fs from 'fs';

function onDatabaseSave(service: AppService) {
  service.updateActiveDatabase();
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  synchronizer: ProfileSynchronizer;
  databaseManager: ProfileDatabaseManager;
  activeDatabaseFilename: string;

  constructor() {
    this.activeDatabaseFilename = null;

    this.databaseManager = new ProfileDatabaseManager();
    this.databaseManager.addEventListener(
      'saved',
      onDatabaseSave.bind(null, this),
    );
    this.synchronizer = new ProfileSynchronizer(this.databaseManager);
    this.synchronizer.start();
  }

  updateActiveDatabase() {
    if (this.databaseManager.lastFilename != null) {
      this.logger.log(
        'updating active database to ' + this.databaseManager.lastFilename,
      );
      this.activeDatabaseFilename = this.databaseManager.lastFilename;
    } else {
      this.logger.warn(
        'Warning: attempting to update active database but last database filename not set.',
      );
    }
  }

  getProfileDatabase(): string {
    if (this.activeDatabaseFilename == null) {
      return '{}';
    } else {
      const data = fs.readFileSync('./data/' + this.activeDatabaseFilename);
      if (data) {
        return data.toString();
      } else {
        return '{}';
      }
    }
  }
}
