---
title: "Navigation2 自主导航与巡逻"
date: 2026-06-22
tags: ["ROS2", "导航", "学习笔记"]
summary: "CHAT7 学习笔记：Nav2 配置、BasicNavigator API、TF 位姿获取、自主巡逻与语音服务。"
---

# CHAT7 ROS2 导航与自主巡逻学习笔记

> Navigation2导航配置、自主巡逻节点、机器人位姿处理

---

## 一、Navigation2 概述

### 常用概念

| 概念 | 说明 |
|------|------|
| Nav2 | ROS2 下一代导航框架 |
| AMCL | 自适应蒙特卡洛定位 |
| Costmap | 代价地图（障碍物表示） |
| BT | Behavior Tree（行为树） |
| Planner | 路径规划器 |
| Controller | 控制器 |

### 核心组件

| 组件 | 功能 |
|------|------|
| `nav2_bringup` | 完整导航启动 |
| `nav2_msgs` | 导航消息定义 |
| `nav2_simple_commander` | 简单导航API |
| `nav2_controller` | 本地路径跟踪 |
| `nav2_planner` | 全局路径规划 |
| `nav2_recoveries` | 恢复行为 |

---

## 二、Navigation2 配置

### 2.1 导航参数文件结构

```yaml
amcl:
  ros__parameters:
    use_sim_time: true
    base_frame_id: "base_footprint"
    global_frame_id: "map"
    odom_frame_id: "odom"
    max_particles: 2000
    min_particles: 500

bt_navigator:
  ros__parameters:
    use_sim_time: true
    global_frame: map
    robot_base_frame: base_link
    default_server_timeout: 20

controller_server:
  ros__parameters:
    use_sim_time: true
    controller_frequency: 20.0
    max_vel: 0.26
    min_vel: 0.01

planner_server:
  ros__parameters:
    use_sim_time: true
    planner_plugin_names: ["GridBased"]

costmap:
  ros__parameters:
    use_sim_time: true
    global_frame: map
    robot_base_frame: base_link
```

### 2.2 地图文件格式

```yaml
image: room.pgm
resolution: 0.05
origin: [0.0, 0.0, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.25
```

### 2.3 导航启动文件

```python
import os
import launch
import launch_ros
from ament_index_python.packages import get_package_share_directory
from launch.launch_description_sources import PythonLaunchDescriptionSource

def generate_launch_description():
    fishbot_navigation2_dir = get_package_share_directory('fishbot_navigation2')
    nav2_bringup_dir = get_package_share_directory('nav2_bringup')
    
    use_sim_time = launch.substitutions.LaunchConfiguration('use_sim_time', default='true')
    map_yaml_path = launch.substitutions.LaunchConfiguration(
        'map', default=os.path.join(fishbot_navigation2_dir, 'maps', 'room.yaml'))
    nav2_param_path = launch.substitutions.LaunchConfiguration(
        'params_file', default=os.path.join(fishbot_navigation2_dir, 'config', 'nav2_params.yaml'))

    return launch.LaunchDescription([
        launch.actions.DeclareLaunchArgument('use_sim_time', default_value=use_sim_time),
        launch.actions.DeclareLaunchArgument('map', default_value=map_yaml_path),
        launch.actions.DeclareLaunchArgument('params_file', default_value=nav2_param_path),
        
        launch.actions.IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                [nav2_bringup_dir, '/launch', '/bringup_launch.py']),
            launch_arguments={
                'map': map_yaml_path,
                'use_sim_time': use_sim_time,
                'params_file': nav2_param_path}.items(),
        ),
        
        launch_ros.actions.Node(
            package='rviz2',
            executable='rviz2',
            name='rviz2',
            arguments=['-d', os.path.join(nav2_bringup_dir, 'rviz', 'nav2_default_view.rviz')],
            parameters=[{'use_sim_time': use_sim_time}],
            output='screen'),
    ])
```

### 2.4 常用命令

```bash
# 启动导航
ros2 launch fishbot_navigation2 navigtion2.launch.py use_sim_time:=true

# 设置初始位姿
ros2 run fishbot_application init_robot_pose

# 查看导航状态
ros2 topic list | grep nav
ros2 topic echo /amcl_pose
```

---

## 三、nav2_simple_commander

### 3.1 BasicNavigator

```python
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
import rclpy

def main():
    rclpy.init()
    nav = BasicNavigator()
    
    # 等待导航激活
    nav.waitUntilNav2Active()
    
    # 创建目标位姿
    from geometry_msgs.msg import PoseStamped
    goal_pose = PoseStamped()
    goal_pose.header.frame_id = 'map'
    goal_pose.pose.position.x = 3.0
    goal_pose.pose.position.y = 3.0
    goal_pose.pose.orientation.w = 1.0
    
    # 导航到目标
    nav.goToPose(goal_pose)
    
    # 等待到达
    while not nav.isTaskComplete():
        feedback = nav.getFeedback()
        if feedback is not None:
            print(f"距离: {feedback.distance_remaining}")
    
    # 获取结果
    result = nav.getResult()
    if result == TaskResult.SUCCEEDED:
        print("到达目标!")
    
    rclpy.shutdown()
```

### 3.2 常用方法

| 方法 | 功能 |
|------|------|
| `waitUntilNav2Active()` | 等待导航系统激活 |
| `goToPose(pose)` | 导航到指定位置 |
| `followWaypoints(poses)` | 多点巡逻 |
| `isTaskComplete()` | 检查任务是否完成 |
| `getFeedback()` | 获取反馈信息 |
| `getResult()` | 获取任务结果 |
| `setInitialPose(pose)` | 设置初始位姿 |
| `cancelTask()` | 取消任务 |

### 3.3 任务结果

```python
from nav2_simple_commander.robot_navigator import TaskResult

TaskResult.SUCCEEDED    # 成功
TaskResult.CANCELED   # 取消
TaskResult.FAILED   # 失败
```

---

## 四、机器人位姿处理

### 4.1 获取机器人位姿

```python
import rclpy
from rclpy.node import Node
from tf2_ros import TransformListener, Buffer
from tf_transformations import euler_from_quaternion
from geometry_msgs.msg import PoseStamped

class GetRobotPose(Node):
    def __init__(self):
        super().__init__('get_robot_pose')
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.pose_stamped = PoseStamped()
        self.pose_stamped.header.frame_id = "map"
        self.timer = self.create_timer(1.0, self.get_transform)

    def get_transform(self):
        try:
            result = self.tf_buffer.lookup_transform("map", "base_footprint", rclpy.time.Time())
            self.pose_stamped.pose.position.x = result.transform.translation.x
            self.pose_stamped.pose.position.y = result.transform.translation.y
            self.pose_stamped.pose.position.z = result.transform.translation.z
            self.pose_stamped.pose.orientation = result.transform.rotation
            
            # 转换为欧拉角
            euler = euler_from_quaternion([
                self.pose_stamped.pose.orientation.x,
                self.pose_stamped.pose.orientation.y,
                self.pose_stamped.pose.orientation.z,
                self.pose_stamped.pose.orientation.w
            ])
            self.get_logger().info(f"x: {self.pose_stamped.pose.position.x}, y: {self.pose_stamped.pose.position.y}, yaw: {euler[2]}")
        except Exception as e:
            self.get_logger().warn(f'TF变换失败: {str(e)}')

def main():
    rclpy.init()
    node = GetRobotPose()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
```

### 4.2 设置初始位姿

```python
from geometry_msgs.msg import PoseStamped
import rclpy
from rclpy.node import Node
from nav2_simple_commander.robot_navigator import BasicNavigator
import time

def main():
    rclpy.init()
    nav = BasicNavigator()
    
    # 等待导航激活
    nav.waitUntilNav2Active()
    
    # 设置初始位姿
    int_pose = PoseStamped()
    int_pose.header.frame_id = 'map'
    int_pose.header.stamp = nav.get_clock().now().to_msg()
    int_pose.pose.position.x = 0.0
    int_pose.pose.position.y = 0.0
    int_pose.pose.position.z = 0.0
    int_pose.pose.orientation.w = 1.0
    
    nav.setInitialPose(int_pose)
    time.sleep(1)
    rclpy.shutdown()
```

---

## 五、自主巡逻节点

### 5.1 PartolNode 核心代码

```python
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseStamped
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
import tf_transformations
from autopartol_interfaces.srv import SpeechText
from sensor_msgs.msg import Image
from cv_bridge import CvBridge
import cv2

class PartolNode(Node):
    def __init__(self):
        super().__init__('partol_node')
        
        # 参数声明
        self.declare_parameter('init_pose', [0.0, 0.0, 0.0])
        self.declare_parameter('waypoints_str', [0.0, 0.0, 0.0, -3.0, -2.0, 0.0])
        self.declare_parameter('image_path', './saved_images')
        
        self.navigator = BasicNavigator()
        self.waypoints = []
        
        # 创建航点
        waypoints_list = self.get_parameter('waypoints_str').value
        self.create_waypoints_from_list(waypoints_list)
        
        self.current_waypoint_index = 0
        self.timer = self.create_timer(1.0, self.navigate_to_waypoint)
        
        # 服务客户端
        self.speaker_client = self.create_client(SpeechText, 'speak_text')
        self.cv_bridge = CvBridge()

    def create_waypoints_from_list(self, waypoints_list):
        for i in range(0, len(waypoints_list), 3):
            pose = PoseStamped()
            pose.header.frame_id = 'map'
            pose.pose.position.x = waypoints_list[i]
            pose.pose.position.y = waypoints_list[i + 1]
            pose.pose.position.z = 0.0
            
            # 转换欧拉角到四元数
            q = tf_transformations.quaternion_from_euler(0, 0, waypoints_list[i + 2])
            pose.pose.orientation.x = q[0]
            pose.pose.orientation.y = q[1]
            pose.pose.orientation.z = q[2]
            pose.pose.orientation.w = q[3]
            
            self.waypoints.append(pose)

    def navigate_to_waypoint(self):
        if self.current_waypoint_index >= len(self.waypoints):
            return
        
        if self.navigator.isTaskComplete():
            self.get_logger().info(f"到达航点 {self.current_waypoint_index}")
            self.current_waypoint_index += 1
            
            if self.current_waypoint_index < len(self.waypoints):
                self.navigator.goToPose(self.waypoints[self.current_waypoint_index])
        else:
            feedback = self.navigator.getFeedback()
            if feedback:
                self.get_logger().info(f"距离目标: {feedback.distance_remaining:.2f}m")
```

### 5.2 节点参数

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `init_pose` | double[] | 初始位置 [x, y, θ] | [0.0, 0.0, 0.0] |
| `waypoints_str` | double[] | 航点列表 [x,y,θ,...] | 多点坐标 |
| `image_path` | string | 图像保存目录 | ./saved_images |

### 5.3 启动命令

```bash
# 带参数启动
ros2 run autopartol_robot partol_node --ros-args \
    -p waypoints_str:="[0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 2.0, 2.0, 0.0]" \
    -p image_path:="/home/test/saved_images"

# 使用配置文件
ros2 run autopartol_robot partol_node
```

---

## 六、服务接口

### 6.1 SpeechText 服务

```srv
# autopartol_interfaces/srv/SpeechText.srv
string text
---
bool success
string message
```

### 6.2 服务调用

```python
from autopartol_interfaces.srv import SpeechText

# 创建服务请求
request = SpeechText.Request()
request.text = "到达巡逻点"

# 调用服务
future = self.speaker_client.call_async(request)
rclpy.spin_until_future_complete(self, future)
response = future.result()
```

### 6.3 命令行调用

```bash
ros2 service call /speak_text autopartol_interfaces/srv/SpeechText "{text: 'hello'}"
```

---

## 七、图像处理

### 7.1 cv_bridge 使用

```python
from sensor_msgs.msg import Image
from cv_bridge import CvBridge
import cv2

def image_callback(self, msg):
    # ROS图像消息转OpenCV
    cv_image = self.cv_bridge.imgmsg_to_cv2(msg, "bgr8")
    
    # 保存图像
    cv2.imwrite(f"{self.image_path}/image_{timestamp}.jpg", cv_image)
    
    # OpenCV转ROS图像消息
    ros_image = self.cv_bridge.cv2_to_imgmsg(cv_image, "bgr8")
```

### 7.2 图像保存

```python
import os
from datetime import datetime

def save_image(self, cv_image):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{self.image_path}/wp_{timestamp}.jpg"
    os.makedirs(self.image_path, exist_ok=True)
    cv2.imwrite(filename, cv_image)
    self.get_logger().info(f"图像已保存: {filename}")
```

---

## 八、TF 坐标变换

### 8.1 常用坐标系

| 坐标系 | 说明 |
|--------|------|
| `map` | 全局地图坐标系 |
| `odom` | 里程计坐标系 |
| `base_footprint` | 机器人底部 |
| `base_link` | 机器人主体 |
| `laser` | 激光雷达 |

### 8.2 坐标变换查询

```bash
# 查看TF变换
ros2 run tf2_ros tf2_echo map base_footprint

# 查看所有坐标系
ros2 run tf2_ros view_frames
```

---

## 九、常用命令汇总

```bash
# 启动导航
ros2 launch fishbot_navigation2 navigtion2.launch.py use_sim_time:=true

# 设置初始位姿
ros2 run fishbot_application init_robot_pose

# 获取机器人位姿
ros2 run fishbot_application get_robot_pose

# 导航到目标点
ros2 run fishbot_application nav2_pose

# 启动巡逻
ros2 run autopartol_robot partol_node

# 查看话题
ros2 topic list | grep -E "(nav|amcl|cmd_vel)"

# 查看服务
ros2 service list | grep speak
```

---

## 十、文件索引

| 文件 | 功能 |
|------|------|
| `config/nav2_params.yaml` | Navigation2参数配置 |
| `maps/room.yaml` | 地图文件 |
| `launch/navigtion2.launch.py` | 导航启动文件 |
| `fishbot_application/get_robot_pose.py` | 获取位姿节点 |
| `fishbot_application/init_robot_pose.py` | 初始化位姿节点 |
| `fishbot_application/nav2_pose.py` | 导航到目标节点 |
| `autopartol_robot/partol_node.py` | 巡逻主节点 |
| `autopartol_interfaces/srv/SpeechText.srv` | 语音服务定义 |
| `config/partol_config.yaml` | 巡逻配置 |