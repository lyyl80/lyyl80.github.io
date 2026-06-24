---
title: "ROS2 Service 通信与参数系统"
date: 2026-06-18
tags: ["ROS2", "Python", "学习笔记"]
summary: "CHAT4 学习笔记：Service 通信、参数系统、PID 控制器、图像处理与 Launch 文件。"
---

# CHAT4 ROS2 学习笔记

> 基于项目代码的知识总结，便于回顾和复现

---

## 一、ROS2 服务通信

### 1.1 自定义服务接口

**定义 .srv 文件**（位于 `chat4_interfaces/srv/`）

```srv
# 请求部分
float32 target_x
float32 target_y
---
# 响应部分
int8 SUCCESS = 1
int8 FAIL = 0
int8 result
```

**编译生成**：
```bash
colcon build
# 自动生成 Python 接口：from chat4_interfaces.srv import Partol
```

### 1.2 服务端实现

```python
from chat4_interfaces.srv import Partol

class MyNode(Node):
    def __init__(self):
        super().__init__('node_name')
        # 创建服务
        self.srv = self.create_service(Partol, 'service_name', self.callback)
    
    def callback(self, request, response):
        # request.target_x, request.target_y
        response.result = 1
        return response  # 必须返回 response
```

### 1.3 客户端调用

```python
# 同步调用
client = self.create_client(Partol, 'service_name')
while not client.wait_for_service(timeout_sec=1.0):
    self.get_logger().info('等待服务...')
    
request = Partol.Request()
request.target_x = 1.0
response = client.call(request)

# 异步调用（推荐）
future = client.call_async(request)
future.add_done_callback(self.callback_handler)
```

---

## 二、ROS2 参数系统

### 2.1 声明参数

```python
self.declare_parameter("param_name", default_value)
# 例如：
self.declare_parameter("k", 0.8)
self.declare_parameter("tar_x", 6.0)
```

### 2.2 读取参数

```python
param = self.get_parameter("k")
value = param.value
# 或直接：
value = self.get_parameter("k").value
```

### 2.3 动态参数更新

```python
# 1. 注册回调
self.add_on_set_parameters_callback(self.param_callback)

# 2. 实现回调
def param_callback(self, params):
    for param in params:
        if param.name == "k":
            self.k = param.value
    return SetParametersResult(successful=True)
```

### 2.4 客户端远程更新参数

```python
from rclpy.parameter import Parameter
from rcl_interfaces.srv import SetParameters

client = self.create_client(SetParameters, 'node_name/set_parameters')
param = Parameter('param_name', value=new_value)
request = SetParameters.Request()
request.parameters = [param]
future = client.call_async(request)
```

---

## 三、ROS2 常用节点类型

### 3.1 发布者

```python
self.publisher = self.create_publisher(TopicMsg, 'topic_name', qos)
self.publisher.publish(msg)
```

### 3.2 订阅者

```python
self.subscription = self.create_subscription(TopicMsg, 'topic_name', self.callback)
def callback(self, msg):
    # 处理消息
    pass
```

### 3.3 定时器

```python
self.timer = self.create_timer(period_seconds, self.callback)
def callback(self):
    # 定期执行
    pass
```

### 3.4 Launch 文件

```python
# launch.py
def generate_launch_description():
    node = launch_ros.actions.Node(
        package='pkg_name',
        executable='exe_name',
        output='screen',
        parameters=[{'param': value}]
    )
    return launch.LaunchDescription([node])
```

---

## 四、PID 控制器

### 4.1 原理

```
输出 = Kp * 误差 + Ki * 积分 + Kd * 微分
```

### 4.2 代码实现

```python
# 初始化
self.p = 2.5    # 比例系数
self.i = 0.05   # 积分系数
self.d = 0.3    # 微分系数

# 计算
p_term = self.p * err_theta
i_term = self.i * self.err_theta_sum
d_term = self.d * (err_theta - self.last_err_theta) / dt

output = p_term + i_term + d_term

# 积分限幅
self.err_theta_sum = max(-1.0, min(1.0, self.err_theta_sum + err_theta * dt))
```

### 4.3 角度归一化

```python
# 将角度误差归一化到 [-π, π]
err_theta = (err_theta + math.pi) % (2 * math.pi) - math.pi
```

---

## 五、图像处理

### 5.1 cv_bridge 使用

```python
from cv_bridge import CvBridge

# ROS Image -> OpenCV
cv_image = self.bridge.imgmsg_to_cv2(ros_image)

# OpenCV -> ROS Image
ros_image = self.bridge.cv2_to_imgmsg(cv_image)
```

### 5.2 人脸检测

```python
import face_recognition
import cv2

# 检测人脸
face_locations = face_recognition.face_locations(
    image,
    number_of_times_to_upsample=1,
    model='hog'  # 或 'cnn'
)

# 绘制矩形
for top, right, bottom, left in face_locations:
    cv2.rectangle(image, (left, top), (right, bottom), (0,0,255), 2)
```

---

## 六、关键代码片段汇总

### 6.1 节点基本结构

```python
import rclpy
from rclpy.node import Node

class MyNode(Node):
    def __init__(self):
        super().__init__('node_name')
        
    def some_method(self):
        pass

def main(args=None):
    rclpy.init(args=args)
    node = MyNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
```

### 6.2 获取包资源路径

```python
from ament_index_python.packages import get_package_share_directory
import os

pkg_path = get_package_share_directory('package_name')
file_path = os.path.join(pkg_path, 'resource', 'image.png')
```

### 6.3 日志输出

```python
self.get_logger().info('消息')
self.get_logger().warn('警告')
self.get_logger().error('错误')
```

---

## 七、常见问题

### Q1: 服务调用无响应
- 检查服务是否已启动：`ros2 service list`
- 检查服务名称是否匹配

### Q2: 参数更新不生效
- 确认已注册回调函数
- 检查回调返回值是否为 `SetParametersResult(successful=True)`

### Q3: 图像转换失败
- 确认 cv_bridge 已安装
- 检查图像编码格式

### Q4: 角度控制振荡
- 增大 D 参数（微分）
- 减小 P 参数（比例）
- 增加积分限幅

---

## 八、运行命令

```bash
# 编译
colcon build

# 运行 launch
ros2 launch demo_python_service launch.py

# 单独运行节点
ros2 run demo_python_service turtle_control
ros2 run demo_python_service face_detect_node

# 查看话题
ros2 topic list

# 查看服务
ros2 service list

# 查看参数
ros2 param list
```

---

## 九、文件索引

| 文件 | 功能 |
|------|------|
| `Partol.srv` | 巡逻服务接口 |
| `FaceDetector.srv` | 人脸检测服务接口 |
| `turtle_control.py` | PID控制 + 服务端 |
| `face_detect_node.py` | 人脸检测服务端 |
| `face_decect_client_node.py` | 人脸检测客户端 |
| `partol_client.py` | 巡逻客户端 |
| `launch.py` | Launch 启动文件 |