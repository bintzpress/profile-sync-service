import { Logger, Injectable } from '@nestjs/common';
import * as https from 'https';
import { ProfileDatabaseManager } from '../database.manager';
import { parseHeadsList } from '../parser/headsList';
import { StringAccumulator } from '../util/util';

@Injectable()
export class ProfileSynchronizer {
  private readonly logger = new Logger(ProfileSynchronizer.name);
  private databaseManager: ProfileDatabaseManager;

  constructor(databaseManager: ProfileDatabaseManager) {
    this.logger.log(`synchronizer created`);
    this.logger.log(
      'setting databaseManager to ' + databaseManager.currentFilename,
    );
    this.databaseManager = databaseManager;
  }

  start() {
    this.logger.log(`synchronizer started`);

    const options = {
      hostname: 'en.wikipedia.org',
      port: 443,
      path: '/wiki/List_of_current_heads_of_state_and_government',
      method: 'GET',
    };

    const accumulator = new StringAccumulator();
    const dm = this.databaseManager;
    const callback = function (response) {
      response.on('data', function (chunk) {
        accumulator.append(chunk);
      });
      response.on('end', parseHeadsList.bind(null, accumulator, dm));
    };

    const req = https.request(options, callback);

    req.on('error', (error) => {
      this.logger.error(error);
    });

    req.end();
  }
}
