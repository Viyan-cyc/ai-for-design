import { defineComponent, h, type Component } from 'vue';
const DemoPoint = defineComponent({
  props: ['id', 'status'],
  setup: props => () => h('div', { style: { background: '#fff', color: '#334155', borderRadius: '8px', padding: '12px 16px', font: '13px sans-serif', boxShadow: '0 2px 12px #0002', maxWidth: '220px' } }, [h('strong', String(props.id)), h('div', String(props.status))]),
});
export const cards: Record<string, Component> = { demo_point: DemoPoint };
