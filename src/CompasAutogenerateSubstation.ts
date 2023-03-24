import {
  html,
  css,
  LitElement,
  query,
  TemplateResult,
  property,
} from 'lit-element';

import '@material/mwc-button';
import '@material/mwc-icon-button';
import '@material/mwc-icon';
import '@material/mwc-dialog';
import '@material/mwc-list';
import '@material/mwc-list/mwc-check-list-item';
import { Dialog } from '@material/mwc-dialog';
import { List } from '@material/mwc-list';
import { ListItemBase } from '@material/mwc-list/mwc-list-item-base';

let bayNum = 1;
let cbNum = 1;
let dsNum = 1;

function createAction(parent: Document): Element {
  const name = 'name';
  const desc = 'desc';
  const guess = true;
  parent.createElement('Substation');
  const element = createElement(parent, 'Substation', {
    name,
    desc,
  });
  return element;
}

function createElement(
  doc: Document,
  tag: string,
  attrs: Record<string, string | null>
): Element {
  const element = doc.createElementNS(doc.documentElement.namespaceURI, tag);
  Object.entries(attrs)
    .filter(([_, value]) => value !== null)
    .forEach(([name, value]) => element.setAttribute(name, value!));
  return element;
}

function compareNames(a: Element | string, b: Element | string): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);

  if (typeof a === 'object' && typeof b === 'string')
    return (a.getAttribute('name') ?? '').localeCompare(b);

  if (typeof a === 'string' && typeof b === 'object')
    return a.localeCompare(b.getAttribute('name')!);

  if (typeof a === 'object' && typeof b === 'object')
    return (a.getAttribute('name') ?? '').localeCompare(
      b.getAttribute('name') ?? ''
    );

  return 0;
}

function addLNodes(condEq: Element, cswi: Element): Element {
  // switchgear ideally is a composition of lnClass CILO,CSWI,XSWI
  cswi.parentElement
    ?.querySelectorAll(
      `LN[lnClass="CSWI"]${
        cswi.getAttribute('prefix')
          ? `[prefix="${cswi.getAttribute('prefix')}"]`
          : ``
      }${
        cswi.getAttribute('inst') ? `[inst="${cswi.getAttribute('inst')}"]` : ``
      },LN[lnClass="CILO"]${
        cswi.getAttribute('prefix')
          ? `[prefix="${cswi.getAttribute('prefix')}"]`
          : ``
      }${
        cswi.getAttribute('inst') ? `[inst="${cswi.getAttribute('inst')}"]` : ``
      },LN[lnClass="XCBR"]${
        cswi.getAttribute('prefix')
          ? `[prefix="${cswi.getAttribute('prefix')}"]`
          : ``
      }${
        cswi.getAttribute('inst') ? `[inst="${cswi.getAttribute('inst')}"]` : ``
      },LN[lnClass="XSWI"]${
        cswi.getAttribute('prefix')
          ? `[prefix="${cswi.getAttribute('prefix')}"]`
          : ``
      }${
        cswi.getAttribute('inst') ? `[inst="${cswi.getAttribute('inst')}"]` : ``
      }`
    )
    .forEach(ln => {
      condEq.appendChild(
        createElement(cswi.ownerDocument, 'LNode', {
          iedName:
            ln.parentElement?.parentElement?.parentElement?.parentElement?.getAttribute(
              'name'
            ) ?? null,
          ldInst: cswi.parentElement?.getAttribute('inst') ?? null,
          prefix: ln.getAttribute('prefix'),
          lnClass: ln.getAttribute('lnClass'),
          lnInst: ln.getAttribute('inst'),
        })
      );
    });

  return condEq;
}

function getSwitchGearType(cswi: Element): string {
  return cswi.parentElement?.querySelector(
    `LN[lnClass="XCBR"]${
      cswi.getAttribute('prefix')
        ? `[prefix="${cswi.getAttribute('prefix')}"]`
        : ``
    }${
      cswi.getAttribute('inst') ? `[inst="${cswi.getAttribute('inst')}"]` : ``
    }`
  )
    ? 'CBR'
    : 'DIS';
}

function getSwitchGearName(ln: Element): string {
  if (ln.getAttribute('prefix') && ln.getAttribute('inst'))
    return ln.getAttribute('prefix')! + ln.getAttribute('inst');

  if (ln.getAttribute('inst') && getSwitchGearType(ln) === 'CBR')
    return 'QA' + cbNum++;

  return 'QB' + dsNum++;
}

function isSwitchGear(ln: Element, selectedCtlModel: string[]): boolean {
  // ctlModel can be configured in IED section.
  if (
    Array.from(
      ln.querySelectorAll('DOI[name="Pos"] > DAI[name="ctlModel"] > Val')
    ).filter(val => selectedCtlModel.includes(val.innerHTML.trim())).length
  )
    return true;

  // ctlModel can be configured as type in DataTypeTemplate section
  const doc = ln.ownerDocument;
  return (
    Array.from(
      doc.querySelectorAll(
        `DataTypeTemplates > LNodeType[id="${ln.getAttribute(
          'lnType'
        )}"] > DO[name="Pos"]`
      )
    )
      .map(DO => (<Element>DO).getAttribute('type'))
      .flatMap(doType =>
        Array.from(
          doc.querySelectorAll(
            `DOType[id="${doType}"] > DA[name="ctlModel"] > Val`
          )
        )
      )
      .filter(val => selectedCtlModel.includes((<Element>val).innerHTML.trim()))
      .length > 0
  );
}

function getCSWI(ied: Element): Element[] {
  return Array.from(
    ied.querySelectorAll('AccessPoint > Server > LDevice > LN[lnClass="CSWI"]')
  );
}

function getValidCSWI(ied: Element, selectedCtlModel: string[]): Element[] {
  if (!ied.parentElement) return [];

  return getCSWI(ied).filter(cswi => isSwitchGear(cswi, selectedCtlModel));
}

function createBayElement(
  ied: Element,
  ctlModelList: string[]
): Element | null {
  const switchGear = getValidCSWI(ied, ctlModelList);
  cbNum = 1;
  dsNum = 1;

  if (switchGear.length) {
    const bay = createElement(ied.ownerDocument, 'Bay', {
      name: 'Q' + bayNum++,
      desc: 'Bay for controller ' + ied.getAttribute('name'),
    });

    const condEq = switchGear.map(cswi => {
      return addLNodes(
        createElement(ied.ownerDocument, 'ConductingEquipment', {
          name: getSwitchGearName(cswi),
          type: getSwitchGearType(cswi),
        }),
        cswi
      );
    });

    condEq.forEach(condEq => bay.appendChild(condEq));

    return bay;
  }
  return null;
}

function guessBasedOnCSWI(
  doc: XMLDocument,
  substation: Element,
  dialog: Dialog,
  element: LitElement
): void {
  const actions: Array<any> = [];
  const ctlModelList = (<ListItemBase[]>(
    (<List>element.shadowRoot?.querySelector('mwc-list')).selected
  )).map(item => item.value);

  const voltageLevel = createElement(doc, 'VoltageLevel', {
    name: 'E1',
    desc: 'guessed by OpenSCD',
    nomFreq: '50.0',
    numPhases: '3',
  });
  const voltage = createElement(doc, 'Voltage', {
    unit: 'V',
    multiplier: 'k',
  });
  voltage.textContent = '110.00';
  voltageLevel.appendChild(voltage);

  actions.push({
    new: { parent: doc.querySelector('SCL')!, element: substation },
  });

  actions.push({
    new: {
      parent: substation,
      element: voltageLevel,
    },
  });

  Array.from(doc.querySelectorAll(':root > IED'))
    .sort(compareNames)
    .map(ied => createBayElement(ied, ctlModelList))
    .forEach(bay => {
      if (bay) actions.push({ new: { parent: voltageLevel, element: bay } });
    });
  console.log(actions);
  dialog.close();
  //return actions;
}

export default class CompasAutogenerateSubstation extends LitElement {
  @query('mwc-dialog#guess-dialog')
  dialog!: Dialog;

  @property() doc!: XMLDocument;

  async run(): Promise<void> {
    this.dialog.show();
  }

  render(): TemplateResult {
    return html`<mwc-dialog
      id="guess-dialog"
      heading="${'compas.autogen.title'}"
    >
      <mwc-list multi id="ctlModelList"
        ><mwc-check-list-item value="status-only"
          >status-only</mwc-check-list-item
        ><mwc-check-list-item value="direct-with-normal-security"
          >direct-with-normal-security</mwc-check-list-item
        ><mwc-check-list-item value="direct-with-enhanced-security"
          >direct-with-enhanced-security</mwc-check-list-item
        ><mwc-check-list-item value="sbo-with-normal-security"
          >sbo-with-normal-security</mwc-check-list-item
        ><mwc-check-list-item selected value="sbo-with-enhanced-security"
          >sbo-with-enhanced-security</mwc-check-list-item
        ></mwc-list
      >
      <mwc-button
        slot="primaryAction"
        icon=""
        label="${'generate'}"
        @click=${() => {
          const substation = createAction(this.doc);
          guessBasedOnCSWI(this.doc, substation, this.dialog, this);
        }}
      >
      </mwc-button>
      <mwc-button
        slot="secondaryAction"
        icon=""
        label="${'close'}"
        dialogAction="close"
        style="--mdc-theme-primary: var(--mdc-theme-error)"
      >
      </mwc-button>
    </mwc-dialog>`;
  }

  static styles = css`
    mwc-dialog {
      --mdc-dialog-min-width: 23vw;
      --mdc-dialog-max-width: 92vw;
    }
  `;
}
