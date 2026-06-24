---
title: "ROS2 Topic 通信：发布订阅与实战"
date: 2026-06-17
tags: ["ROS2", "Python", "学习笔记"]
summary: "CHAPT3 学习笔记：Topic 发布/订阅、消息类型、定时器、海龟控制与小说阅读系统。"
---

# CHAPT3 Topic 通信学习笔记

> 发布/订阅模式、消息类型、定时器、海龟控制

---

## 一、ROS2 发布/订阅

### 1.1 发布者

```python
from example_interfaces.msg import String
from geometry_msgs.msg import Twist

class PubNode(Node):
    def __init__(self):
        super().__init__('node_name')
        # 创建发布者
        self.publisher = self.create_publisher(String, 'topic_name', 10)
        
        # 定时发布
        self.timer = self.create_timer(1.0, self.timer_callback)
    
    def timer_callback(self):
        msg = String()
        msg.data = "消息内容"
        self.publisher.publish(msg)
```

### 1.2 订阅者

```python
class SubNode(Node):
    def __init__(self):
        super().__init__('node_name')
        # 创建订阅者
        self.subscription = self.create_subscription(
            String, 
            'topic_name', 
            self.callback,
            10
        )
    
    def callback(self, msg):
        self.get_logger().info(f"收到: {msg.data}")
```

---

## 二、常用消息类型

```python
from example_interfaces.msg import String    # 字符串
from geometry_msgs.msg import Twist           # 速度命令
from turtlesim.msg import Pose                # 海龟位姿
from sensor_msgs.msg import Image             # 图像
```

### Twist 消息

```python
twist = Twist()
twist.linear.x = 1.0    # 线速度
twist.angular.z = 1.0   # 角速度
```

### Pose 消息

```python
# 订阅 turtlesim 位姿
subscription = self.create_subscription(Pose, 'turtle1/pose', callback, 10)

def callback(self, pose):
    x = pose.x
    y = pose.y
    theta = pose.theta
```

---

## 三、定时器

```python
# 每秒执行一次
self.timer = self.create_timer(1.0, self.callback)

def callback(self):
    # 定时执行的任务
    pass
```

---

## 四、海龟控制

### 4.1 圆周运动

```python
class TurtleCircle(Node):
    def __init__(self):
        super().__init__('turtle_circle')
        self.publisher = self.create_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.timer = self.create_timer(1, self.move_circle)
    
    def move_circle(self):
        twist = Twist()
        twist.linear.x = 1.0
        twist.angular.z = 1.0
        self.publisher.publish(twist)
```

### 4.2 PID 到达目标点

```python
import math

class TurRealControl(Node):
    def __init__(self):
        super().__init__('turtle_control')
        self.publisher = self.create_publisher(Twist, 'turtle1/cmd_vel', 10)
        self.subscription = self.create_subscription(Pose, 'turtle1/pose', self.on_pose_receive, 10)
        
        self.tar_x = 5.0
        self.tar_y = 5.0
        self.p = 1.5
        self.i = 0.1
        self.d = 0.05
    
    def on_pose_receive(self, pose):
        err_x = self.tar_x - pose.x
        err_y = self.tar_y - pose.y
        dis = math.sqrt(err_x**2 + err_y**2)
        tar_theta = math.atan2(err_y, err_x)
        
        # 角度归一化
        err_theta = tar_theta - pose.theta
        err_theta = (err_theta + math.pi) % (2 * math.pi) - math.pi
        
        # PID 计算
        angular_z = self.p * err_theta
        
        if dis > 0.05:
            twist = Twist()
            twist.angular.z = angular_z
            twist.linear.x = min(dis, 1.0)
            self.publisher.publish(twist)
```

---

## 五、实战：小说朗读系统

### 5.1 发布端：下载并发布小说

```python
import requests
from queue import Queue

class NovelPubNode(Node):
    def __init__(self):
        super().__init__('novel_pub')
        self.queue = Queue()
        self.publisher = self.create_publisher(String, 'novel', 10)
        self.timer = self.create_timer(5, self.timer_callback)
        self.download_novel()
    
    def download_novel(self):
        response = requests.get('http://127.0.0.1:8000/novel1.txt')
        for line in response.text.splitlines():
            self.queue.put(line)
    
    def timer_callback(self):
        if self.queue.qsize() > 0:
            msg = String()
            msg.data = self.queue.get()
            self.publisher.publish(msg)
```

### 5.2 订阅端：接收并朗读

```python
import espeakng
import threading

class NovelSubNode(Node):
    def __init__(self):
        super().__init__('novel_sub')
        self.queue = Queue()
        self.subscriber = self.create_subscription(String, 'novel', self.callback, 10)
        
        # 启动朗读线程
        self.speech_thread = threading.Thread(target=self.speek_thread)
        self.speech_thread.start()
    
    def callback(self, msg):
        self.queue.put(msg.data)
    
    def speek_thread(self):
        speaker = espeakng.Speaker()
        speaker.voice = 'zh'
        while rclpy.ok():
            if self.queue.qsize() > 0:
                speaker.say(self.queue.get())
                speaker.wait()
            else:
                time.sleep(1)
```

---

## 六、要点总结

| 概念 | 代码 |
|------|------|
| 发布者 | `create_publisher(MsgType, 'topic', qos)` |
| 订阅者 | `create_subscription(MsgType, 'topic', callback, qos)` |
| 定时器 | `create_timer(period, callback)` |
| 消息发布 | `publisher.publish(msg)` |
| 多线程 | `threading.Thread(target=func)` |

---

## 七、运行命令

```bash
# 启动海龟模拟器
ros2 run turtlesim turtlesim_node

# 圆周运动
ros2 run demo_python_topic turtle_circle

# PID 控制到目标点
ros2 run demo_python_topic turtle_control

# 小说发布
ros2 run demo_python_topic novel_pub_node

# 小说订阅朗读
ros2 run demo_python_topic novel_sub_node
```

---

## 八、文件索引

| 文件 | 功能 |
|------|------|
| `novel_pub_node.py` | 小说发布端 |
| `novel_sub_node.py` | 小说订阅+朗读 |
| `turtle_circle.py` | 海龟圆周运动 |
| `turtle_control.py` | 海龟PID控制到目标点 |