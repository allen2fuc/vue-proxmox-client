import {createApp} from 'vue'
import ElementPlus from 'element-plus'
import {createStore} from 'vuex'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'

// 创建一个新的 store 实例
const store = createStore({
    state() {
        return {
            CSRFPreventionToken: null,
            ticket: null,
            node: null
        }
    },
    mutations: {
        setCSRFPreventionToken(state, token) {
            state.CSRFPreventionToken = token;
        },
        setTicket(state, ticket) {
            state.ticket = ticket;
        },
        setNode(state, node) {
            state.node = node;
        }
    },
    actions: {
        saveLoginInfo({commit}, {CSRFPreventionToken, ticket}) {
            commit('setCSRFPreventionToken', CSRFPreventionToken);
            commit('setTicket', ticket);
        },
        saveNodeInfo({commit}, {node}) {
            commit('setNode', node);
        }
    },
    getters: {
        getCSRFPreventionToken: state => state.CSRFPreventionToken,
        getTicket: state => state.ticket,
        getNode: state => state.node,
    }
})

const app = createApp(App)
app.use(ElementPlus)
// 将 store 实例作为插件安装
app.use(store)
// 使用默认的cors中间件
app.mount('#app')