import {type RouteRecordRaw} from 'vue-router'

/**
 * 這邊是提供給大家使用的，方便知道如何使用這些路由
 * @example
 * ```ts
 * import {routes} from '@/router/routes'
 * routes.index.name // 這樣就可以取得路由的 name
 * ```
 */
export const routes = {
    index: {
        name: 'Home',
        path: 'home',
        meta: {
            title: '首頁',
            roles: [],
            requiresAuth: false
        },
        component: () => import('@/views/Task.vue')
    } satisfies RouteRecordRaw
}

const layouts = {
    root: {
        path: '/',
        redirect: () => {
            return { name: routes.index.name }
        }
    },
    main: {
        path: '/',
        children: [
            routes.index
        ]
    }
    // auth: {
    //     path: '/auth',
    //     component: () => import('@/layouts/AuthLayout.vue'),
    //     children: [
    //         routes.index
    //     ]
    // }
}

/**
 * 這邊是專門給 router 使用的路由配置
 */
const routerRoutes: RouteRecordRaw[] = [
    ...Object.values(layouts)
]

export default routerRoutes
