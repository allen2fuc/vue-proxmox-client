# VUE-Simple-Proxmox-Client

## 1. 第一步打包
```bash
# 构建镜像
$ docker build -t allen2fuc/vue-proxmox-client:latest .

# 删除容器
$ docker rm -f vue-proxmox-client

# 运行容器
$ docker run -d -p 8080:80 --name vue-proxmox-client vue-proxmox-client

# 查看日志
$ docker logs -f vue-proxmox-client
$ docker exec -it vue-proxmox-client cat /var/log/nginx/access.log

# 查看错误日志
$ docker exec -it vue-proxmox-client cat /var/log/nginx/error.log


# 打标签
# $ docker tag vue-proxmox-client allen2fuc/vue-proxmox-client:latest
# 推送
$ docker push allen2fuc/vue-proxmox-client:latest

```