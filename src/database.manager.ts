import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class ProfileDatabaseManager {
  private readonly logger = new Logger(ProfileDatabaseManager.name);
  database = { countries: {} };

  lastFilename: string;
  currentFilename: string;

  constructor() {
    this.lastFilename = null;
    this.currentFilename = new Date().getTime() + '.json';
  }

  insert(data) {
    this.logger.log('inserting ' + data.state.name + ' into database');
    this.database.countries[data.state.name] = {
      href: data.state.href,
      headOfState: {},
      headOfGovernment: {},
      headOfStateAndGovernment: {},
    };

    let entry;
    let d;
    let k;
    let target;
    const keys = [
      'headOfState',
      'headOfGovernment',
      'headOfStateAndGovernment',
    ];
    let source;
    for (k = 0; k < keys.length; k++) {
      target = this.database.countries[data.state.name][keys[k]];
      for (d = 0; d < data[keys[k]].length; d++) {
        source = data[keys[k]][d];
        this.logger.log('Adding ' + source.title + ' ' + source.name);
        entry = {
          href: source.href,
          ceremonial: source.ceremonial,
          executiveAdministrator: source.executiveAdministrator,
          title: source.title,
        };

        target[source.name] = entry;
      }
    }
  }

  save() {
    const data = JSON.stringify(this.database, null, 4);
    const d = new Date();
    fs.writeFile('./data/' + this.currentFilename, data, 'utf8', (err) => {
      if (err) {
        this.logger.error(`Error: writing database: ${err}`);
      } else {
        this.logger.log(`Successfully wrote database`);
        this.lastFilename = this.currentFilename;
        this.currentFilename = new Date().getTime() + '.json';
        this.fireListenerEvent('saved');
      }
    });
  }

  listeners = {};

  addEventListener(event: string, f: () => void) {
    this.listeners[event] = [];
    this.listeners[event].push(f);
  }

  removeEventListener(event: string, f: () => void) {
    let i = 0;
    let found = false;
    while (!found && i < this.listeners[event].length) {
      if (this.listeners[event][i] == f) {
        found = true;
      } else {
        i++;
      }
    }

    if (found) {
      this.listeners[event] = this.listeners[event].splice(i, 1);
    }
  }

  fireListenerEvent(event: string) {
    this.logger.log(
      'firing event for ' +
        event +
        ' there are ' +
        this.listeners[event].length +
        ' listeners',
    );

    let i;
    for (i = 0; i < this.listeners[event].length; i++) {
      this.listeners[event][i]();
    }
  }
}
