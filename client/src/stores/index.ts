import {createPinia} from 'pinia'
import persist from 'pinia-plugin-persistedstate'
// 記得在這邊加入你的 store
// export * from './modules/AppStore'

const pinia = createPinia()
pinia.use(persist)

export default pinia
