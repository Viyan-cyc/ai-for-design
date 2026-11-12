# 接口及边界
create(scene,preset,invalidate)返回update/tick/snapshot/dispose；destroy幂等。只处理本实例对象。静止时不循环绘制，交互调用invalidate。宿主更新前完整校验。导入仅同一已知候选文件集的参数，不执行导入源码。未知代码必须独立开发审查后新建宿主；不自动安装。无生产保存/撤销适配证明，留后续独立工程验证。启动：node scripts/prepare.mjs；python -m http.server 4190 --bind 127.0.0.1；访问example/。Node24及Python3由环境提供，不自动安装。
