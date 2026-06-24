---
title: "TF 坐标变换：静态与动态广播"
date: 2026-06-19
tags: ["ROS2", "Python", "学习笔记"]
summary: "CHAT5 学习笔记：TF 坐标变换、静态/动态广播器、监听器、欧拉角与四元数转换。"
---

# CHAT5 TF 坐标变换学习笔记

> 静态/动态坐标发布、坐标监听、欧拉角与四元数转换

---

## 一、TF 概念

**TF (Transform)**：坐标变换库，用于跟踪多个坐标系之间的空间关系。

### 常用术语

| 术语 | 说明 |
|------|------|
| `frame_id` | 父坐标系 |
| `child_frame_id` | 子坐标系 |
| `TransformStamped` | 带时间戳的变换消息 |

---

## 二、静态坐标变换

### 2.1 广播器

```python
from tf2_ros import StaticTransformBroadcaster
from geometry_msgs.msg import TransformStamped
from tf_transformations import quaternion_from_euler
import math

class StaticTFBroadcaster(Node):
    def __init__(self):
        super().__init__('static_tf_broadcaster')
        self.broadcaster = StaticTransformBroadcaster(self)
        transform = self.create_static_transform()
        self.broadcaster.sendTransform(transform)
    
    def create_static_transform(self):
        transform = TransformStamped()
        transform.header.stamp = self.get_clock().now().to_msg()
        transform.header.frame_id = 'base_link'      # 父坐标系
        transform.child_frame_id = 'camera_link'     # 子坐标系
        
        # 平移
        transform.transform.translation.x = 0.5
        transform.transform.translation.y = 0.3
        transform.transform.translation.z = 0.6
        
        # 旋转：欧拉角 → 四元数
        roll = math.radians(180)
        pitch = math.radians(0)
        yaw = math.radians(0)
        quat = quaternion_from_euler(roll, pitch, yaw)
        
        transform.transform.rotation.x = quat[0]
        transform.transform.rotation.y = quat[1]
        transform.transform.rotation.z = quat[2]
        transform.transform.rotation.w = quat[3]
        
        return transform
```

---

## 三、动态坐标变换

### 3.1 广播器

```python
from tf2_ros import TransformBroadcaster

class DynamicTFBroadcaster(Node):
    def __init__(self):
        super().__init__('dynamic_tf_broadcaster')
        self.broadcaster = TransformBroadcaster(self)
        self.timer = self.create_timer(0.01, self.broadcast_callback)
    
    def broadcast_callback(self):
        transform = TransformStamped()
        transform.header.frame_id = 'camera_link'
        transform.child_frame_id = 'bottle_link'
        transform.header.stamp = self.get_clock().now().to_msg()
        
        # 设置变换数据...
        
        self.broadcaster.sendTransform(transform)
```

### 静态 vs 动态

| 类型 | 发布器 | 使用场景 |
|------|--------|----------|
| 静态 | `StaticTransformBroadcaster` | 固定不动的坐标（如传感器安装位置） |
| 动态 | `TransformBroadcaster` | 运动的坐标（如机器人关节） |

---

## 四、坐标监听

### 4.1 监听器

```python
from tf2_ros import TransformListener, Buffer
from tf_transformations import euler_from_quaternion
from rclpy.time import Time

class TFListerner(Node):
    def __init__(self):
        super().__init__('tf_listener')
        self.buffer = Buffer()
        self.tf_listener = TransformListener(self.buffer, self)
        self.timer = self.create_timer(1.0, self.listener_callback)
    
    def listener_callback(self):
        try:
            # 查询坐标变换：从 base_link 到 bottle_link
            result = self.buffer.lookup_transform(
                'base_link',
                'bottle_link',
                Time(seconds=0)  # 最新时刻
            )
            
            trans = result.transform
            
            # 获取平移
            self.get_logger().info(f"平移: x={trans.translation.x}")
            
            # 四元数 → 欧拉角
            quaternion = (
                trans.rotation.x,
                trans.rotation.y,
                trans.rotation.z,
                trans.rotation.w
            )
            roll, pitch, yaw = euler_from_quaternion(quaternion)
            self.get_logger().info(
                f"旋转: Roll={math.degrees(roll):.1f}°, "
                f"Pitch={math.degrees(pitch):.1f}°, Yaw={math.degrees(yaw):.1f}°"
            )
        except Exception as e:
            self.get_logger().error(f"获取变换失败: {e}")
```

### 4.2 常用方法

```python
# 最新时刻
result = buffer.lookup_transform('parent', 'child', Time(seconds=0))

# 指定时刻
result = buffer.lookup_transform('parent', 'child', Time(seconds=5))

# 等待变换（最多等待3秒）
result = buffer.lookup_transform('parent', 'child', Time(seconds=0), timeout=Duration(seconds=3))
```

---

## 五、欧拉角与四元数

### 5.1 转换关系

```python
from tf_transformations import quaternion_from_euler, euler_from_quaternion
import math

# 欧拉角 → 四元数
roll, pitch, yaw = math.radians(180), math.radians(0), math.radians(0)
qx, qy, qz, qw = quaternion_from_euler(roll, pitch, yaw)

# 四元数 → 欧拉角
quaternion = (qx, qy, qz, qw)
roll, pitch, yaw = euler_from_quaternion(quaternion)
```

### 5.2 旋转顺序

- `quaternion_from_euler(roll, pitch, yaw)` - ZYX 顺序
- 返回 `(x, y, z, w)`

---

## 六、常用命令

```bash
# 查看坐标关系
ros2 run tf2_ros view_frames

# 监听变换
ros2 run tf2_ros tf_echo parent_frame child_frame
# 例如：
ros2 run tf2_ros tf_echo base_link camera_link

# 广播静态变换
ros2 run demo_python_tf static_tf_broadcaster

# 广播动态变换
ros2 run demo_python_tf dynamic_tf_broadcaster

# 监听变换
ros2 run demo_python_tf tf_listener
```

---

## 七、要点总结

| 知识点 | 代码 |
|--------|------|
| 静态广播器 | `StaticTransformBroadcaster(self)` |
| 动态广播器 | `TransformBroadcaster(self)` |
| 变换消息 | `TransformStamped` |
| 欧拉角→四元数 | `quaternion_from_euler(roll, pitch, yaw)` |
| 四元数→欧拉角 | `euler_from_quaternion(quaternion)` |
| 监听变换 | `buffer.lookup_transform(parent, child, time)` |

---

## 八、文件索引

| 文件 | 功能 |
|------|------|
| `static_tf_broadcaster.py` | 静态坐标发布 |
| `dynamic_tf_broadcaster.py` | 动态坐标发布 |
| `tf_listener.py` | 坐标监听与查询 |
| `launch/launch.py` | 启动文件 |