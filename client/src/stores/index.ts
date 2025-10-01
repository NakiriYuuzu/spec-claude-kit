import {createPinia} from 'pinia'
import persist from 'pinia-plugin-persistedstate'

// Export stores
export * from './chat'

const pinia = createPinia()
pinia.use(persist)

export default pinia
