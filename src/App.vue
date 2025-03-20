<template>
  <el-form :inline="true" :model="loginPro" class="demo-form-inline" v-loading="loginLoading">

    <el-form-item label="用户名称">
      <el-input v-model="loginPro.username" placeholder="用户名称" clearable/>
    </el-form-item>

    <el-form-item label="用户密码">
      <el-input show-password v-model="loginPro.password" placeholder="用户密码" clearable/>
    </el-form-item>

    <el-form-item label="记住我">
      <el-switch
          v-model="loginPro.rememberMe"
          inline-prompt
          active-text="是"
          inactive-text="否"
      />
    </el-form-item>

    <el-form-item>
      <el-button type="primary" @click="onLogin">登陆</el-button>
    </el-form-item>

    <el-form-item label="节点">
      <el-select v-model="selectedNode" placeholder="请选择节点" style="width: 100px">
        <el-option
            v-for="item in nodes.items"
            :key="item.id"
            :label="item.node"
            :value="item.node"
        />
      </el-select>
    </el-form-item>

    <el-table :data="vms" v-loading="tableLoading" :row-class-name="tableRowClassName" style="width: 100%">
      <el-table-column prop="vmid" label="ID" min-width="6%"/>
      <el-table-column prop="name" label="名称" min-width="17%"/>
      <el-table-column prop="qmpstatus" label="状态" min-width="12%"/>
      <el-table-column prop="ip" label="地址" min-width="20%"/>
      <el-table-column label="操作" min-width="25%">
        <template #default="scope">
          <el-button round type="success" size="small"
                     :loading="startLoading"
                     @click="handleStart(scope.$index, scope.row)"
                     v-if="scope.row.qmpstatus === 'stopped'">开机
          </el-button>
          <el-button size="small"
                     round
                     :loading="restartLoading"
                     @click="handleRestart(scope.$index, scope.row)"
                     v-if="scope.row.qmpstatus === 'running'">重启
          </el-button>
          <el-button round type="info" size="small"
                     :loading="stopLoading"
                     @click="handleStop(scope.$index, scope.row)"
                     v-if="scope.row.qmpstatus === 'running' && (scope.row.qmpstatus !== 'suspended' || scope.row.qmpstatus !== 'paused')">
            关机
          </el-button>
          <el-button round type="primary" size="small"
                     :loading="resumeLoading"
                     @click="handleResume(scope.$index, scope.row)"
                     v-if="scope.row.qmpstatus === 'suspended' || scope.row.qmpstatus === 'paused'">
            恢复
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="进度" min-width="20%">
        <template #default="scope">

          <!--          <el-button round type="success" size="small" @click="enableAutoRefresh(scope.$index, scope.row)"-->
          <!--                     v-if="scope.row.ipInterval == undefined"-->
          <!--                     v-loading="refreshLoading">刷新-->
          <!--          </el-button>-->
          <!--          <el-button round type="info" size="small" @click="disableAutoRefresh(scope.$index, scope.row)"-->
          <!--                     v-if="scope.row.ipInterval != null"-->
          <!--                     v-loading="refreshLoading">停止-->
          <!--          </el-button>-->

          <el-progress
              :percentage="progressPercentage"
              :stroke-width="15"
              status="success"
              :color="progressColors"
              striped
              striped-flow
          />

        </template>
      </el-table-column>
    </el-table>

  </el-form>

</template>

<script lang="ts" setup>
import {computed, h, onMounted, reactive, ref, watch} from 'vue'
import axios from "axios";
import {useStore} from 'vuex';
import {Action, ElMessage, ElMessageBox} from "element-plus";
import {Base64} from 'js-base64';
import Cookies from 'js-cookie';

const progressPercentage = ref<number>(100)

const progressColors = [
  {color: '#f56c6c', percentage: 20},
  {color: '#e6a23c', percentage: 40},
  {color: '#5cb87a', percentage: 60},
  {color: '#1989fa', percentage: 80},
  {color: '#6f7ad3', percentage: 100},
]

const store = useStore();
const tableLoading = ref<boolean>(false)
const loginLoading = ref<boolean>(false)
const restartLoading = ref<boolean>(false)
const stopLoading = ref<boolean>(false)
const startLoading = ref<boolean>(false)
const resumeLoading = ref<boolean>(false)


// 定义登陆属性
const loginPro = reactive({
  username: '',
  password: '',
  rememberMe: true,
})

// 定义节点属性
interface NodeItem {
  id: string;
  node: string;
}

// 定义节点列表
const nodes = reactive({
  items: [] as NodeItem[],
});

// 定义选中的节点
const selectedNode = ref('');

onMounted(() => {
  // 尝试获取用户名和密码
  queryLoginFormLocal();
})

interface VMItem {
  vmid: number
  name: string,
  qmpstatus: string,
  ip: string,
  ipInterval: number | null;
}

const tableRowClassName = ({
                             row,
                             rowIndex,
                           }: {
  row: VMItem
  rowIndex: number
}) => {
  if (rowIndex % 3 == 0) {
    return 'warning-row'
  }else if (rowIndex % 3 == 1) {
    return 'success-row'
  } else {
    return ''
  }
}


const vms: VMItem[] = reactive<VMItem[]>([])

// 登陆
const onLogin = () => {
  loginLoading.value = true
  console.log('submit!')
  axios.post('/api/access/ticket', {
    username: loginPro.username,
    password: loginPro.password
  })
      .then(function (response) {
        const {CSRFPreventionToken, ticket} = response.data.data;

        // 保存到 Vuex 或 localStorage/sessionStorage
        store.dispatch('saveLoginInfo', {CSRFPreventionToken, ticket});

        // 设置 Cookie
        Cookies.set('PVEAuthCookie', ticket, {expires: 7});  // 有效期为 7 天

        // 设置默认请求头
        axios.defaults.headers.common['CSRFPreventionToken'] = CSRFPreventionToken;

        // 查询所有节点
        getNodes()

        loginLoading.value = false

        saveLoginToLocal();
      })
      .catch(function (error) {
        ElMessage(error.response.data);

        loginLoading.value = false
      });
}

// 获取节点列表
const getNodes = () => {
  axios('/api/nodes', {
    withCredentials: true, // 自动发送凭证（包括 Cookie）
  }).then(function (response) {
    nodes.items = response.data.data; // 直接赋值给 items
    selectedNode.value = nodes.items[0].node;
    console.log(response.data.data);
    getVms()
  })
};


// 获取所有虚拟机
const getVms = () => {
  const currentNode = selectedNode.value
  if (!currentNode) {
    vms.length = 0; // 清空 vms
    return;
  }
  tableLoading.value = true;

  axios(`/api/nodes/${currentNode}/qemu`, {
    withCredentials: true, // 自动发送凭证（包括 Cookie）
  }).then(function (response) {
    const sortedVms = response.data.data.sort((a, b) => a.vmid - b.vmid);
    vms.splice(0, vms.length, ...sortedVms);

    vms.forEach((vm, index) => {
      handleCurrent(index, vm);
    });

    console.log(sortedVms);
  }).catch(function (error) {
    ElMessage.error('获取虚拟机数据失败');
    console.error('Error:', error);
  }).finally(function () {
    tableLoading.value = false;
  })
};

// 监听 selectedNode 的变化，当节点变化时重新获取虚拟机数据
watch(selectedNode, (newNode) => {
  if (newNode) {
    getVms();
  }
});

//查询本地是否存了用户名密码 此处写在OnMounted即可
const queryLoginFormLocal = () => {
  const localForm = Cookies.get('LOCAL_KEY')
  if (localForm) {
    loginPro.rememberMe = true
    try {
      const {username, password} = JSON.parse(localForm)
      loginPro.username = Base64.decode(username)
      loginPro.password = Base64.decode(password)
    } catch (error) {
      console.error('本地数据解析失败~', error)
    }
  } else {
    loginPro.rememberMe = false
  }
}

const saveLoginToLocal = () => {
  // 转码
  const {username, password} = loginPro
  const params = {
    username: Base64.encode(username),
    password: Base64.encode(password),
  }

// 检测是否需要记住密码 checked就是记住密码绑定的值
  if (loginPro.rememberMe) {
    const {username, password} = params
    const localForm = {
      username,
      password,
    }
    Cookies.set('LOCAL_KEY', JSON.stringify(localForm), {expires: 365})
  } else {
    Cookies.remove('LOCAL_KEY')
  }
}

// 启动自动刷新
const enableAutoRefresh = (index, row) => {
  if (!row.ipInterval) {
    row.ipInterval = setInterval(() => {
      try {
        handleCurrent(index, row);
      }catch (e) {

      }
      console.log(row.ipInterval);
    }, 1000);
  }
}

// 禁止自动刷新
const disableAutoRefresh = (index, row) => {
  if (row.ipInterval) {
    clearInterval(row.ipInterval);
    row.ipInterval = null; // 或者 row.ipInterval = null;
  }
}

// 获取IP地址
const handleGetIP = (index, row) => {
  axios(`/api/nodes/${selectedNode.value}/qemu/${row.vmid}/agent/network-get-interfaces`, {
    withCredentials: true,
  }).then(function (response) {
    // 从数组中获取ip-addresses，判断ip-address-type为ipv4
    const ipArray = response.data.data.result;
    // 帮我参照这个网站的内容，获取ip-addresses，判断ip-address-type为ipv4，https://pve.proxmox.com/pve-docs/api-viewer/index.html#/nodes/{node}/qemu/{vmid}/agent/network-get-interfaces
    const ipv4Address = ipArray.find((item: any) =>
        item['ip-addresses'].find((item: any) => item['ip-address-type'] === 'ipv4' && item['prefix'] === 24));
    if (ipv4Address && ipv4Address['ip-addresses']) {
      const ipInfo = ipv4Address['ip-addresses'].find((ipInfo: any) =>
          ipInfo['ip-address-type'] === 'ipv4' &&
          ipInfo['prefix'] === 24
      );
      if (ipInfo && ipInfo !== row.ip) {
        row.ip = ipInfo['ip-address'];
        return;
      }
    }
    row.ip = '';
  }).catch(err => {
    row.ip = '';
  })

}

// 请求启动云主机
function handleStart(index, row) {
  progressPercentage.value = 0;
  startLoading.value = true;

  // 请求虚拟机启动
  axios(`/api/nodes/${selectedNode.value}/qemu/${row.vmid}/status/start`, {
    method: 'POST',
    withCredentials: true, // 自动发送凭证（包括 Cookie）
  }).then(function (response) {
    console.log(response.data.data)
    enableAutoRefresh(index, row);

    if (progressPercentage.value <= 90) {
      progressPercentage.value += 10;
    } else if (progressPercentage.value <= 95) {
      progressPercentage.value += 1;
    }

    watch(() => row.ip, (newValue, oldValue) => {
      // if (newValue !== oldValue) {
        disableAutoRefresh(index, row);
        progressPercentage.value = 100;
        startLoading.value = false;
      // }
    })

  }).catch(function (error) {
    console.error('Error:', error);
    ElMessage({message: '操作失败', type: 'error',});
    startLoading.value = false;
  })
}

// 停止云主机
function handleStop(index, row) {
  ElMessageBox.confirm(
      '你确定要强制停止云电脑吗？',
      'Warning',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
  )
      .then(() => {
        progressPercentage.value = 0;
        stopLoading.value = true;

        axios(`/api/nodes/${selectedNode.value}/qemu/${row.vmid}/agent/shutdown`, {
          method: 'POST',
          withCredentials: true, // 自动发送凭证（包括 Cookie）
        }).then(function (response) {
          console.log(response.data.data)
          enableAutoRefresh(index, row);

          if (progressPercentage.value <= 90) {
            progressPercentage.value += 10;
          } else if (progressPercentage.value <= 95) {
            progressPercentage.value += 1;
          }

          // stopLoading.value = false;
          // handleCurrent(row, index);
          // row.qmpstatus = 'stopped';
          watch(() => row.qmpstatus, (newValue, oldValue) => {
            if (newValue === 'stopped') {
              disableAutoRefresh(index, row);
              progressPercentage.value = 100;
              row.ip = '';
              stopLoading.value = false;
            }
          })
        }).catch(function (error) {
          console.log(error);
          ElMessage({message: '操作失败', type: 'error',});
          stopLoading.value = false;
        })

      });
}

// 重新启动云主机
function handleRestart(index, row) {

  ElMessageBox.confirm(
      '你确定要重启云电脑吗？',
      'Warning',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
  )
      .then(() => {

        progressPercentage.value = 0;
        restartLoading.value = true;

        // 重启请求
        axios(`/api/nodes/${selectedNode.value}/qemu/${row.vmid}/status/reboot`, {
          method: 'POST',
          withCredentials: true, // 自动发送凭证（包括 Cookie）
        }).then(function (response) {
          console.log(response.data.data)
          row.ip = '';
          enableAutoRefresh(index, row)

          if (progressPercentage.value <= 90) {
            progressPercentage.value += 10;
          } else if (progressPercentage.value <= 98) {
            progressPercentage.value += 1;
          }

          watch(() => row.ip, (newValue, oldValue) => {
            // if (newValue !== oldValue) {
              disableAutoRefresh(index, row);
              progressPercentage.value = 100;
              restartLoading.value = false;
            // }
          });
        }).catch(function (error) {
          console.log(error);
          restartLoading.value = false;
        })

      })


}

// 更新虚拟机状态
const handleCurrent = (index, row) => {
  axios(`/api/nodes/${selectedNode.value}/qemu/${row.vmid}/status/current`, {
    withCredentials: true,
  }).then(function (response) {
    console.log(response.data.data)
    row.qmpstatus = response.data.data.qmpstatus;

    pingAgentAndGetIP(index, row);
    // handleGetIP(index, row);
  }).catch(function (error) {
    console.error(error);
  });
};

// 暂停虚拟机
function handlePause(index, row) {
  axios(`/api/nodes/${selectedNode.value}/qemu/${row.vmid}/status/suspend`, {
    method: 'POST',
    withCredentials: true, // 自动发送凭证（包括 Cookie）
  }).then(function (response) {
    console.log(response.data.data)
    handleCurrent(index, row);
  }).catch(function (error) {
    console.log(error)
    ElMessage({message: '操作失败', type: 'error',});
  })
}

// 恢复云主机
function handleResume(index, row) {
  progressPercentage.value = 0;
  resumeLoading.value = true;

  axios(`/api/nodes/${selectedNode.value}/qemu/${row.vmid}/status/resume`, {
    method: 'POST',
    withCredentials: true, // 自动发送凭证（包括 Cookie）
  }).then(function (response) {
    console.log(response.data.data)
    enableAutoRefresh(index, row)

    if (progressPercentage.value <= 90) {
      progressPercentage.value += 10;
    } else if (progressPercentage.value <= 98) {
      progressPercentage.value += 1;
    }

    watch(() => row.ip, (newValue, oldValue) => {
      if (newValue !== oldValue) {
        disableAutoRefresh(index, row);
        progressPercentage.value = 100;
        resumeLoading.value = false;
      }
    });
  }).catch(function (error) {
    console.log(error)
    resumeLoading.value = false;
    ElMessage({
      message: '操作失败', type: 'error',
    })
  })
}

function pingAgentAndGetIP(index, row){
  axios(`/api/nodes/${selectedNode.value}/qemu/${row.vmid}/agent/ping`, {
    method: 'POST',
    withCredentials: true, // 自动发送凭证（包括 Cookie）
  }).then(function (response) {
    console.log(response.data.data)

    handleGetIP(index, row);

  }).catch(function (error) {
    console.log(error)
  })
}
</script>

<style>
.demo-form-inline .el-input {
  --el-input-width: 220px;
}

.demo-form-inline .el-select {
  --el-select-width: 220px;
}

.el-table .warning-row {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}

.el-table .success-row {
  --el-table-tr-bg-color: var(--el-color-success-light-9);
}
</style>
