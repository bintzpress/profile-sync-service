import { Injectable, Logger } from '@nestjs/common';
import * as XRegExp from 'xregexp';
import { ProfileDatabaseManager } from '../database.manager';
import { StringAccumulator } from '../util/util';
import * as jsdom from 'jsdom';

export function parseHeadsList(
  accumulator: StringAccumulator,
  databaseManager: ProfileDatabaseManager,
) {
  const parser = new HeadsListParser();
  parser.parse(accumulator, databaseManager);
}

@Injectable()
class HeadsListParser {
  private readonly logger = new Logger(HeadsListParser.name);

  parse(
    accumulator: StringAccumulator,
    databaseManager: ProfileDatabaseManager,
  ) {
    const dom = new jsdom.JSDOM(accumulator.get());
    const rowspan = [0, 0, 0];
    let cancel = false;
    let columnsLeft;
    let cell;
    let row;
    let parsed;
    let column;
    const data = {
      headOfGovernment: [],
      headOfState: [],
      state: { name: '', href: '' },
      headOfStateAndGovernment: [],
    };
    let isFirstState = true;
    let addresses;
    let bothHeads;
    let result;

    const table = dom.window.document.querySelector('.wikitable');
    if (table) {
      this.logger.log('Got a table\n');
      const rows = table.querySelectorAll('tr');
      if (rows) {
        this.logger.log('Got ' + rows.length + ' rows' + '\n');
        let i;
        for (i = 1; i < rows.length; i++) {
          this.logger.log('Processing row ' + i + '\n');
          this.logger.log(
            'Row spans are ' + rowspan[0] + ' ' + rowspan[1] + ' ' + rowspan[2],
          );
          column = 0;
          bothHeads = false;
          this.logger.log('column is 0\n');
          row = rows[i];
          const cells = row.querySelectorAll('td, th');
          if (cells) {
            this.logger.log('Found ' + cells.length + ' cells in row\n');
            if (rowspan[0] > 0) {
              this.logger.log('Rowspan 0 is ' + rowspan[0] + '\n');
              rowspan[0]--;
              if (rowspan[1] > 0) {
                this.logger.log('Rowspan 1 is ' + rowspan[1] + '\n');
                rowspan[1]--;
                if (rowspan[2] > 0) {
                  // log error shouldn't happen. would be spanning all columns
                  this.logger.error('Error: spanning all columns\n');
                  cancel = true;
                } else {
                  if (column >= cells.length) {
                    // log error missing cell
                    this.logger.error('Error: missing cell\n');
                    cancel = true;
                  } else {
                    cell = cells[column];
                    column++;
                    this.logger.log('Column set to ' + column + '\n');

                    if (cell.hasAttribute('rowspan')) {
                      parsed = parseInt(cell.getAttribute('rowspan'), 10);
                      if (isNaN(parsed) || rowspan[2] > 0) {
                        // log error
                        // just ignore
                        this.logger.warn(
                          'Warning: invalid rowspan - ignoring\n',
                        );
                      } else {
                        this.logger.log(
                          'Setting rowspan 2 to ' + (parsed - 1) + '\n',
                        );
                        rowspan[2] = parsed - 1;
                      }
                    }
                    if (cell.hasAttribute('colspan')) {
                      parsed = parseInt(cell.getAttribute('colspan'), 10);
                      if (isNaN(parsed)) {
                        // log error
                        // just ignore
                        this.logger.warn(
                          'Warning: invalid colspan - ignoring\n',
                        );
                      } else {
                        // log error. would be spanning past 3 columns
                        // just ignore
                        this.logger.warn(
                          'Warning: spanning past 3 columns - ignoring\n',
                        );
                      }
                    }

                    // column is head of government
                    this.logger.log('\n---- Found head of government ----\n');
                    result = this.processCellEntries(cell, data.state.name);
                    data.headOfGovernment.push(...result); // push result to array
                    this.logger.log('Setting columns left to 0\n');
                    columnsLeft = 0;
                  }
                }
              } else {
                if (column >= cells.length) {
                  this.logger.warn(
                    'Warning: missing cell - continuing with next line\n',
                  );
                  this.logger.log('Setting columns left to 0\n');
                  columnsLeft = 0;
                } else {
                  cell = cells[column];
                  column++;
                  this.logger.log('Column set to ' + column + '\n');
                  if (cell.hasAttribute('rowspan')) {
                    parsed = parseInt(cell.getAttribute('rowspan'), 10);
                    if (isNaN(parsed) || rowspan[1] > 0) {
                      // log error
                      this.logger.warn('Warning: invalid rowspan - ignoring\n');
                    } else {
                      this.logger.log(
                        'Setting rowspan 1 to ' + (parsed - 1) + '\n',
                      );
                      rowspan[1] = parsed - 1;
                    }
                  }
                  if (cell.hasAttribute('colspan')) {
                    parsed = parseInt(cell.getAttribute('colspan'), 10);
                    if (isNaN(parsed) || parsed > 2) {
                      // log error
                      this.logger.warn('Warning: invalid colspan - ignoring\n');
                    } else {
                      this.logger.log('Setting columns left to 0\n');
                      columnsLeft = 0;
                      bothHeads = true;
                    }
                  } else {
                    if (rowspan[2] > 0) {
                      this.logger.log('Reducing rowspan 2 by one\n');
                      rowspan[2]--; // next column is
                      this.logger.log('Setting columns left to 0\n');
                      columnsLeft = 0;
                    } else {
                      this.logger.log('Setting columns left to 1\n');
                      columnsLeft = 1;
                    }
                  }

                  // column is head of state
                  this.logger.log('\n---- Found head of state ----\n');
                  result = this.processCellEntries(cell, data.state.name);
                  // push results to arrays
                  if (bothHeads) {
                    data.headOfStateAndGovernment.push(...result);
                  } else {
                    data.headOfState.push(...result);
                  }
                }
              }
            } else {
              if (column >= cells.length) {
                // log error
                this.logger.warn(
                  'Warning: missing cell - continuing next row\n',
                );
                this.logger.log('Setting columns left to 0\n');
                columnsLeft = 0;
              } else {
                cell = cells[column];
                column++;
                this.logger.log('Column set to ' + column + '\n');

                if (cell.hasAttribute('rowspan')) {
                  parsed = parseInt(cell.getAttribute('rowspan'), 10);
                  if (isNaN(parsed) || rowspan[0] > 0) {
                    // log error
                    this.logger.warn('Warning: invalid rowspan - ignoring\n');
                  } else {
                    rowspan[0] = parsed - 1;
                    this.logger.log(
                      'Setting rowspan 0 to ' + (parsed - 1) + '\n',
                    );
                  }
                }

                if (cell.hasAttribute('colspan')) {
                  parsed = parseInt(cell.getAttribute('colspan'), 10);
                  if (isNaN(parsed) || parsed > 2) {
                    // log error
                    this.logger.warn('Warning: invalid colspan - ignoring\n');
                  } else if (parsed == 2) {
                    this.logger.log('Setting columns left to 1\n');
                    columnsLeft = 1;
                  } else {
                    this.logger.log('Setting columns left to 2\n');
                    columnsLeft = 2;
                  }
                } else {
                  this.logger.log('Setting columns left to 2\n');
                  columnsLeft = 2;
                }

                // column is state
                this.logger.log('\n---- Found state ----\n');
                if (!isFirstState && data.state.name == '') {
                  this.logger.error('Error: missing state for data\n');
                  cancel = true;
                } else {
                  if (!isFirstState) {
                    databaseManager.insert(data);
                  } else {
                    isFirstState = false;
                  }
                }

                addresses = cell.querySelectorAll('a');
                if (!addresses || addresses.length != 1) {
                  this.logger.warn(
                    '--- Inner HTML ----\n' + cell.innerHTML + '\n',
                  );
                  this.logger.warn(
                    'Warning: invalid address or not one address\n',
                  );
                  data.state.name = '';
                  data.state.href = '';
                } else {
                  this.logger.log(
                    'New state name is ' + addresses[0].textContent + '\n',
                  );
                  data.state.name = addresses[0].textContent;
                  data.state.href = addresses[0].getAttribute('href');
                }
                data.headOfState.length = 0;
                data.headOfGovernment.length = 0;
                data.headOfStateAndGovernment.length = 0;
              }
            }

            if (!cancel && columnsLeft == 2) {
              this.logger.log('Processing 2 remaining columns\n');
              if (rowspan[1] > 0) {
                this.logger.log('Rowspan 1 is ' + rowspan[1] + '\n');
                rowspan[1]--;
                if (rowspan[2] > 0) {
                  this.logger.log('Rowspan 2 is ' + rowspan[2] + '\n');
                  rowspan[2]--;
                  // done don't process more
                } else {
                  if (column >= cells.length) {
                    // log error
                    this.logger.warn(
                      'Warning: missing cell - continuing next row\n',
                    );
                    this.logger.log('Setting columns left to 0\n');
                    columnsLeft = 0;
                  } else {
                    cell = cells[column];
                    column++;
                    this.logger.log('Column set to ' + column + '\n');
                    if (cell.hasAttribute('rowspan')) {
                      parsed = parseInt(cell.getAttribute('rowspan'), 10);
                      if (isNaN(parsed) || rowspan[2] > 0) {
                        // log error
                        this.logger.warn(
                          'Warning: invalid rowspan - ignoring\n',
                        );
                      } else {
                        rowspan[2] = parsed - 1;
                        this.logger.log(
                          'Setting rowspan 2 to ' + (parsed - 1) + '\n',
                        );
                      }
                    }

                    if (cell.hasAttribute('colspan')) {
                      // log error but ignore
                      this.logger.warn('Warning: invalid colspan - ignoring\n');
                    }

                    // column is head of government
                    this.logger.log('\n---- Found head of government ----\n');

                    result = this.processCellEntries(cell, data.state.name);
                    data.headOfGovernment.push(...result); // pushes all the entries

                    this.logger.log('Setting columns left to 0\n');
                    columnsLeft = 0;
                  }
                }
              } else {
                if (column >= cells.length) {
                  // log error
                  this.logger.warn(
                    'Warning: missing cell - continuing on next row\n',
                  );
                  this.logger.log('Setting columns left to 0\n');
                  columnsLeft = 0;
                } else {
                  cell = cells[column];
                  column++;
                  this.logger.log('Column set to ' + column + '\n');

                  if (cell.hasAttribute('rowspan')) {
                    parsed = parseInt(cell.getAttribute('rowspan'), 10);
                    if (isNaN(parsed) || rowspan[1] > 0) {
                      // log error
                      this.logger.warn('Warning: invalid rowspan - ignoring\n');
                    } else {
                      rowspan[1] = parsed - 1;
                      this.logger.log(
                        'Setting rowspan 1 to ' + (parsed - 1) + '\n',
                      );
                    }
                  }
                  if (cell.hasAttribute('colspan')) {
                    parsed = parseInt(cell.getAttribute('colspan'), 10);
                    if (isNaN(parsed) || parsed > 2) {
                      // log error
                      this.logger.warn('Warning: invalid colspan - ignoring\n');
                    } else {
                      this.logger.log('Setting columns left to 0\n');
                      columnsLeft = 0;
                      bothHeads = true;
                    }
                  } else {
                    this.logger.log('Setting columns left to 1\n');
                    columnsLeft = 1;
                  }

                  // column is head of state
                  this.logger.log('\n---- Found head of state ----\n');
                  result = this.processCellEntries(cell, data.state.name);
                  if (bothHeads) {
                    data.headOfStateAndGovernment.push(...result);
                  } else {
                    data.headOfState.push(...result); // pushes all the entries
                  }
                }
              }
            }

            if (!cancel && columnsLeft == 1) {
              this.logger.log('Process 1 remaining column\n');
              if (rowspan[2] > 0) {
                this.logger.log('Rowspan 2 is ' + rowspan[2] + '\n');
                rowspan[2]--;
                // should be done processing
              } else {
                if (column >= cells.length) {
                  // log error
                  this.logger.warn(
                    'Warning: missing cell - continuing next row\n',
                  );
                  this.logger.log('Settings columns left to 0\n');
                  columnsLeft = 0;
                } else {
                  cell = cells[column];
                  column++;
                  this.logger.log('Column set to ' + column + '\n');

                  if (cell.hasAttribute('rowspan')) {
                    parsed = parseInt(cell.getAttribute('rowspan'), 10);
                    if (isNaN(parsed) || rowspan[2] > 0) {
                      // log error
                      this.logger.warn('Warning: invalid rowspan - ignoring\n');
                    } else {
                      rowspan[2] = parsed - 1;
                      this.logger.log(
                        'Setting rowspan 2 to ' + (parsed - 1) + '\n',
                      );
                    }
                  }

                  if (cell.hasAttribute('colspan')) {
                    // log but ignore
                    this.logger.warn('Warning: invalid colspan - ignoring\n');
                  }

                  this.logger.log('\n---- Found head of government ----\n');
                  result = this.processCellEntries(cell, data.state.name);
                  data.headOfGovernment.push(...result); // this pushes all the entries
                }
              }
            }
          }

          if (cancel) {
            this.logger.error('Error: parsing was cancelled\n');
            break;
          }
        }
      }
    }

    if (data.state.name != '') {
      databaseManager.insert(data); // insert last entry
    }
    databaseManager.save();
  }

  processCellEntries(cell, stateName: string): any[] {
    const result = [];
    this.logger.log('processCellEntries stateName: ' + stateName + '\n');
    if (stateName == '') {
      this.logger.warn(
        'Warning: found head of government without state name first\n',
      );
    } else {
      let isExecutiveAdministrator = false;
      let isCeremonial = false;

      const backgroundColor = cell.style.backgroundColor;
      this.logger.log('Found background: ' + backgroundColor);
      if (backgroundColor) {
        if (cell.style.backgroundColor == 'rgb(158, 255, 158)') {
          isExecutiveAdministrator = true;
        } else if (cell.style.backgroundColor == 'rgb(204, 238, 255)') {
          isCeremonial = true;
        } else {
          this.logger.warn(
            'Warning: unknown cell background found ' + backgroundColor,
          );
        }
      }

      const text = cell.textContent;
      this.logger.log('Cell text content is ' + text);
      let entry;

      const regexp = XRegExp(/([\w'\- ]+)\u00A0\u2013 ([\w'\- ]+)/gu);
      let matchResult;
      let foundMatch = false;
      while ((matchResult = regexp.exec(text))) {
        this.logger.log('found matches. processing cell text content.');
        entry = {
          title: matchResult[1],
          href: '',
          name: matchResult[2],
          executiveAdministrator: isExecutiveAdministrator,
          ceremonial: isCeremonial,
        };
        result.push(entry);
        foundMatch = true;
      }

      if (!foundMatch) {
        const regexp2 = XRegExp(/([\w'\- ]+) \(as ([\w'\- ]+)\)/gu);
        foundMatch = false;
        while ((matchResult = regexp2.exec(text))) {
          this.logger.log(
            'found matches using regex type 2. processing cell text content.',
          );
          entry = {
            title: matchResult[2],
            href: '',
            name: matchResult[1],
            executiveAdministrator: isExecutiveAdministrator,
            ceremonial: isCeremonial,
          };
          result.push(entry);
          foundMatch = true;
        }
      }

      if (!foundMatch) {
        const items: Element[] = cell.querySelectorAll('ul li');
        if (items && items.length > 0) {
          let d;
          let address: Element;
          let addresses: NodeListOf<HTMLAnchorElement>;

          const regexp3 = XRegExp(/Members: ([\w'\- ]+) \(([\w'\- ]+)\)/gu);
          matchResult = regexp3.exec(items[0].textContent);
          if (matchResult) {
            entry = {
              title: matchResult[2],
              href: '',
              name: matchResult[1],
              executiveAdministrator: isExecutiveAdministrator,
              ceremonial: isCeremonial,
            };
            addresses = items[0].querySelectorAll('a');
            if (addresses && addresses.length >= 2) {
              entry.url = addresses[1].getAttribute('href');
            }

            result.push(entry);
            foundMatch = true;
          }

          const regexp4 = XRegExp(/([\w'\- ]+) \(([\w'\- ]+)\)/gu);
          for (d = 1; d < items.length; d++) {
            matchResult = regexp4.exec(items[d].textContent);
            if (matchResult) {
              entry = {
                title: matchResult[2],
                href: '',
                name: matchResult[1],
                executiveAdministrator: isExecutiveAdministrator,
                ceremonial: isCeremonial,
              };
            } else {
              entry = {
                title: 'Member',
                href: '',
                name: items[d].textContent,
                executiveAdministrator: isExecutiveAdministrator,
                ceremonial: isCeremonial,
              };
            }

            address = items[d].querySelector('a');
            if (address) {
              entry.url = address.getAttribute('href');
            }

            result.push(entry);
            foundMatch = true;
          }
        }
      }
      if (!foundMatch) {
        this.logger.warn('Warning: unable to process data in cell');
        this.logger.warn(cell.innerHTML);
      } else {
        // find the href for the leaders
        const addresses = cell.querySelectorAll('a');
        if (!addresses) {
          this.logger.warn('Warning: missing addresses for cell');
        } else {
          let e;
          for (e = 0; e < result.length; e++) {
            let d;
            for (d = 0; d < addresses.length; d++) {
              if (addresses[d].textContent == result[e].name) {
                result[e].href = addresses[d].getAttribute('href');
              }
            }
          }
        }
      }
    }

    this.logger.log('process entry results: ' + result.length);
    return result;
  }
}
