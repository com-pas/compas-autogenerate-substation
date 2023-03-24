import { html, TemplateResult } from 'lit-element';
//import '../src/compas-autogenerate-substation.js';
import CompasAutogenerateSubstation from '../src/CompasAutogenerateSubstation.js';
import '../src/CompasAutogenerateSubstation.js';
export default {
  title: 'CompasAutogenerateSubstation',
  component: 'compas-autogenerate-substation',
  argTypes: {},
};

class SBCompasAutogenerateSubstation extends CompasAutogenerateSubstation {
  firstUpdated() {
    super.run();
  }
}

interface Story<T> {
  (args: T): TemplateResult;
  args?: Partial<T>;
  argTypes?: Record<string, unknown>;
}

interface ArgTypes {
  allowLocalFile?: boolean;
}

const Template: Story<ArgTypes> = ({ allowLocalFile = true }: ArgTypes) => {
  if (customElements.get('compas-autogenerate-substation') === undefined)
    customElements.define(
      'compas-autogenerate-substation',
      SBCompasAutogenerateSubstation
    );
  return html`<p>Testing</p>
    <compas-autogenerate-substation> </compas-autogenerate-substation> `;
};

export const Regular = Template.bind({});
