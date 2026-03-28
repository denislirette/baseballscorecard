import DefaultTheme from 'vitepress/theme'
import './custom.css'
import Diamond from './components/Diamond.vue'
import PlayCell from './components/PlayCell.vue'
import ColorSwatch from './components/ColorSwatch.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Diamond', Diamond)
    app.component('PlayCell', PlayCell)
    app.component('ColorSwatch', ColorSwatch)
  },
}
