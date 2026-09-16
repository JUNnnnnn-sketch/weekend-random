# 北京地铁数据来源记录

获取日期：2026-09-16

## 已核验的公开来源

- 名称：北京市轨道站点信息（出行）
- 发布方：北京市公共数据开放平台；数据提供单位为北京市交通委员会
- 页面：https://data.beijing.gov.cn/zyml/ajg/sjtw/3246d313de5c4470826f7384a297688b.htm
- 开放条件：页面标注为“无条件开放”，更新频率为年度；页面未给出可复用的具体许可证文本。
- 页面记录字段：线路名、车站名、站点编码。
- 页面显示更新时间：2026-08-06。

## 本项目的决定

当前公开元数据不包含站点 `latitude`、`longitude` 或可用于可靠推导坐标的空间要素。因此该来源不能单独满足本项目的完整地铁模块契约：

- `line_id`
- `line_name`
- `stations[].station_id`
- `stations[].station_name`
- `stations[].station_order`
- `stations[].latitude`
- `stations[].longitude`

本次没有导入或转换该数据，也没有修改 `subway.js` 中的测试数据。原因是项目的距离推荐依赖真实坐标；缺少坐标时，补造或混入未核验坐标会破坏推荐结果的可靠性。

## 后续导入前需要补齐的数据

需要一个公开、可核验、允许再利用的数据集，同时提供每个北京地铁站的：线路归属、线路内顺序、稳定站点标识、WGS84 经纬度，以及数据许可/使用条件。导入时应记录原始数据版本和获取日期，并把字段映射为本项目的数据契约；不得把 GCJ-02、BD-09 或变形线路图坐标当作 WGS84 坐标直接写入。

## 2026-09-16 多源交叉核验尝试

- OpenStreetMap Wiki（北京地铁关系 `13495290`）：https://wiki.openstreetmap.org/wiki/Zh-hans:北京地铁
  - 用途：核验 OSM 中北京地铁网络关系、运营线路总数和关系建模方式。
  - 许可：页面内容为 CC BY-SA 2.0，OSM 地理数据库本身为 ODbL 1.0；实际导入 OSM 几何与坐标时须同时保留 OSM 署名和 ODbL 义务。
- OpenStreetMap API 网络关系：`https://www.openstreetmap.org/api/0.6/relation/13495290/full`
  - 用途：原计划读取路线关系成员、沿线路顺序提取站点，并读取 OSM 节点坐标。
  - 结果：本次获取环境无法建立到 `www.openstreetmap.org` 的连接；公开 Overpass 端点也未能返回可用关系导出。因此没有取得可审计的原始 OSM 响应，未导入任何 OSM 站点或坐标。
- MetroMap 北京线路页示例：https://beijing.metromap.me/zh/line/05
  - 用途：辅助核对公开展示的线路站序；页面声明站序来源为北京地铁、坐标为 © OpenStreetMap contributors。
  - 结果：仅作交叉核验，不作为数据导入源或唯一权威来源。

由于没有成功取得可复现、可保留审计记录的完整 OSM 原始响应，本项目仍未生成完整模块。`subway.js` 保持测试数据，避免将不可复核的第三方坐标写入距离推荐。
