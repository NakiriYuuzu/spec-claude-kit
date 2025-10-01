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
        name: 'Chat',
        path: 'chat',
        meta: {
            title: 'Chat',
            roles: [],
            requiresAuth: false
        },
        component: () => import('@/views/Chat.vue')
    } satisfies RouteRecordRaw,
	notFound: {
		name: 'Not Found',
		path: 'not-found',
		meta: {
			title: 'Not Found',
			roles: [],
			requiresAuth: false
		},
		component: () => import('@/views/Chat.vue')
	}
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
        ],
		component: () => import('@/components/layout/MainLayout.vue')
    },
	notFound: {
		path: '/:pathMatch(.*)*',
		redirect: () => {
			return { name: routes.notFound.name }
		}
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
