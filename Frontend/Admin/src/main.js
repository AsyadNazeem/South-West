import { createApp } from 'vue'
import './styles/variables.css'
import './styles/global.css'
import App from './App.vue'
import router from './router'
import {
    hasAllPermissions,
    hasAnyPermission,
    hasPermission
} from './auth/authorization'

const app = createApp(App)

app.config.globalProperties.$can = hasPermission
app.config.globalProperties.$canAny = hasAnyPermission
app.config.globalProperties.$canAll = hasAllPermissions

app
    .use(router)
    .mount('#app')
