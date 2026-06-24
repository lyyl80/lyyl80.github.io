---
title: "ROS2 完整学习路径（CHAPT2 ~ CHAT8）"
date: 2026-06-24
tags: ["ROS2", "Python", "学习笔记"]
summary: "从基础节点到自主导航，覆盖 ROS2 核心知识体系的完整学习路线图。"
---

# ROS2 完整学习路径（CHAPT2 ~ CHAT8）

> 从零基础到自主导航机器人——一条循序渐进的学习路线

---

## 学习路线总览

```
 CHAPT2                CHAPT3              CHAT4               CHAT5
┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
│ ROS2基础 │ ──────→ │ 话题通信 │ ──────→ │ 服务通信 │ ──────→ │ TF变换  │
│ 节点/继承│         │ 发布/订阅│         │ 参数/服务│         │ 欧拉/四元│
└─────────┘         └─────────┘         └─────────┘         └─────────┘
                                                                  │
      ┌───────────────────────────────────────────────────────────┘
      ▼
   CHAT6              CHAT7               CHAT8
┌─────────┐         ┌─────────┐         ┌──────────────┐
│ 模型仿真 │ ──────→ │ Nav2导航 │ ──────→ │ 自定义插件    │
│URDF/Gazebo│        │ 自主巡逻 │         │ pluginlib/C++ │
└─────────┘         └─────────┘         └──────────────┘
```

**逻辑关系**：

| 阶段 | 章节 | 核心能力 | 为后续铺垫 |
|------|------|----------|------------|
| 入门 | CHAPT2 | 节点创建、类继承、多线程 | 后续所有章节的基础 |
| 核心 | CHAPT3 | 话题通信、消息类型、定时器 | 机器人控制的数据通道 |
| 核心 | CHAT4 | 服务通信、参数系统、PID控制 | 请求-响应模式、动态配置 |
| 进阶 | CHAT5 | TF坐标变换、四元数/欧拉角 | 机器人空间位姿感知 |
| 实战 | CHAT6 | URDF/Xacro建模、Gazebo仿真 | 物理仿真环境构建 |
| 实战 | CHAT7 | Navigation2导航、自主巡逻 | 完整导航应用 |
| 高阶 | CHAT8 | pluginlib插件、自定义Nav2 | 框架扩展与定制 |

---

# 第一阶段：ROS2 核心基础

---

## CHAPT2 — ROS2 基础（节点与多线程）

### 1. 最简单节点

```python
import rclpy
from rclpy.node import Node

def main(args=None):
    rclpy.init(args=args)
    node = Node('node_name')
    node.get_logger().info('消息')
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
```

### 2. 类继承节点

```python
class PersonNode(Node):
    def __init__(self, name: str, age: int, node_name: str):
        super().__init__(node_name)
        self.name = name
        self.age = age

    def eat(self, food_name: str):
        self.get_logger().info(f'{self.name} is eating {food_name}')

class WriterNode(PersonNode):
    def __init__(self, name, age, book: str, node_name: str):
        super().__init__(name, age, node_name)
        self.book = book
```

### 3. 多线程下载

```python
import threading

class Download:
    def start_download(self, urls, callback, delay=0.5):
        threads = []
        for url in urls:
            thread = threading.Thread(target=self.download, args=(url, callback))
            thread.start()
            threads.append(thread)
        for thread in threads:
            thread.join()
```

### 4. 关键要点

| 概念 | 核心代码 |
|------|----------|
| 初始化 | `rclpy.init()` |
| 创建节点 | `Node('name')` |
| 继承节点 | `super().__init__(node_name)` |
| 日志输出 | `get_logger().info()` |
| 多线程 | `threading.Thread` + `join()` |

---

## CHAPT3 — Pub/Sub 话题通信 + 小说朗读实战

### 1. 发布者模式

```python
class PubNode(Node):
    def __init__(self):
        super().__init__('node_name')
        self.publisher = self.create_publisher(String, 'topic_name', 10)
        self.timer = self.create_timer(1.0, self.timer_callback)

    def timer_callback(self):
        msg = String()
        msg.data = "消息内容"
        self.publisher.publish(msg)
```

### 2. 订阅者模式

```python
class SubNode(Node):
    def __init__(self):
        super().__init__('node_name')
        self.subscription = self.create_subscription(
            String, 'topic_name', self.callback, 10)

    def callback(self, msg):
        self.get_logger().info(f"收到: {msg.data}")
```

### 3. 常用消息类型

| 消息类型 | 用途 |
|----------|------|
| `String` | 文本消息 |
| `Twist` | 速度命令 (linear.x, angular.z) |
| `Pose` | 位姿 (x, y, theta) |
| `Image` | 图像数据 |

### 4. PID 控制基础

```python
import math

def on_pose_receive(self, pose):
    err_x = self.tar_x - pose.x
    err_y = self.tar_y - pose.y
    dis = math.sqrt(err_x**2 + err_y**2)
    tar_theta = math.atan2(err_y, err_x)

    err_theta = tar_theta - pose.theta
    err_theta = (err_theta + math.pi) % (2 * math.pi) - math.pi

    angular_z = self.p * err_theta
    linear_x = min(dis, 1.0)
```

### 5. 实战：小说朗读系统

```
[HTTP下载] → [队列缓存] → [话题发布] → [话题订阅] → [语音朗读]
   多线程           Queue      Publisher    Subscriber    espeakng
```

---

## CHAT4 — 服务通信 + 参数系统

### 1. 自定义服务接口

```srv
float32 target_x
float32 target_y
---
int8 result
```

**编译** → `colcon build` → 自动生成 `from chat4_interfaces.srv import Partol`

### 2. 服务端实现

```python
class MyNode(Node):
    def __init__(self):
        self.srv = self.create_service(Partol, 'service_name', self.callback)

    def callback(self, request, response):
        response.result = 1
        return response  # 必须返回
```

### 3. 客户端调用

```python
# 同步调用
client = self.create_client(Partol, 'service_name')
while not client.wait_for_service(timeout_sec=1.0):
    pass
request = Partol.Request()
request.target_x = 1.0
response = client.call(request)

# 异步调用（推荐）
future = client.call_async(request)
future.add_done_callback(self.callback_handler)
```

### 4. 参数系统

```python
# 声明
self.declare_parameter("k", 0.8)

# 读取
value = self.get_parameter("k").value

# 动态更新回调
self.add_on_set_parameters_callback(self.param_callback)
```

### 5. 人脸检测集成

```python
import face_recognition

face_locations = face_recognition.face_locations(
    image, number_of_times_to_upsample=1, model='hog')

for top, right, bottom, left in face_locations:
    cv2.rectangle(image, (left, top), (right, bottom), (0,0,255), 2)
```

### 6. Topic vs Service 对比

| 特性 | Topic (话题) | Service (服务) |
|------|-------------|---------------|
| 通信模式 | 发布/订阅（单向） | 请求/响应（双向） |
| 适用场景 | 持续数据流 | 一次性请求 |
| 典型用途 | 传感器数据、速度命令 | 触发动作、查询状态 |

---

# 第二阶段：进阶能力

---

## CHAT5 — TF 坐标变换

### 1. TF 概念

| 术语 | 说明 |
|------|------|
| `frame_id` | 父坐标系 |
| `child_frame_id` | 子坐标系 |
| `TransformStamped` | 带时间戳的变换消息 |

### 2. 静态坐标广播器

```python
from tf2_ros import StaticTransformBroadcaster
from tf_transformations import quaternion_from_euler

class StaticTFBroadcaster(Node):
    def __init__(self):
        super().__init__('static_tf_broadcaster')
        self.broadcaster = StaticTransformBroadcaster(self)
        transform = TransformStamped()
        # parent → child
        transform.header.frame_id = 'base_link'
        transform.child_frame_id = 'camera_link'
        # 平移
        transform.transform.translation.x = 0.5
        # 旋转：欧拉角 → 四元数
        quat = quaternion_from_euler(roll, pitch, yaw)
        transform.transform.rotation.x = quat[0]
        transform.transform.rotation.y = quat[1]
        transform.transform.rotation.z = quat[2]
        transform.transform.rotation.w = quat[3]
        self.broadcaster.sendTransform(transform)
```

### 3. 动态坐标广播器

```python
from tf2_ros import TransformBroadcaster

class DynamicTFBroadcaster(Node):
    def __init__(self):
        self.broadcaster = TransformBroadcaster(self)
        self.timer = self.create_timer(0.01, self.broadcast_callback)
```

### 4. 坐标监听器

```python
from tf2_ros import TransformListener, Buffer
from tf_transformations import euler_from_quaternion

class TFListerner(Node):
    def __init__(self):
        self.buffer = Buffer()
        self.tf_listener = TransformListener(self.buffer, self)

    def listener_callback(self):
        result = self.buffer.lookup_transform('base_link', 'bottle_link', Time(seconds=0))
        trans = result.transform
        roll, pitch, yaw = euler_from_quaternion([trans.rotation.x, ...])
```

### 5. 欧拉角 ↔ 四元数

```python
from tf_transformations import quaternion_from_euler, euler_from_quaternion

# 欧拉角 → 四元数
qx, qy, qz, qw = quaternion_from_euler(roll, pitch, yaw)

# 四元数 → 欧拉角
roll, pitch, yaw = euler_from_quaternion((qx, qy, qz, qw))
```

### 6. 静态 vs 动态

| 类型 | 发布器 | 频率 | 使用场景 |
|------|--------|------|----------|
| 静态 | `StaticTransformBroadcaster` | 一次性 | 传感器安装位置 |
| 动态 | `TransformBroadcaster` | 持续 | 机器人关节运动 |

---

## CHAT6 — 机器人模型与仿真

### 1. URDF 建模

```xml
<robot name="fishbot">
    <link name="base_link">
        <inertial>
            <mass value="1.0"/>
        </inertial>
        <visual>
            <geometry><cylinder length="0.3" radius="0.1"/></geometry>
        </visual>
        <collision>
            <geometry><cylinder length="0.3" radius="0.1"/></geometry>
        </collision>
    </link>

    <joint name="joint_name" type="continuous">
        <parent link="parent_link"/>
        <child link="child_link"/>
        <axis xyz="0 1 0"/>
    </joint>
</robot>
```

### 2. 关节类型

| 类型 | 说明 |
|------|------|
| `revolute` | 旋转（有角度限制） |
| `continuous` | 连续旋转（无限制） |
| `fixed` | 固定 |
| `prismatic` | 直线移动 |

### 3. Xacro 模板化

```xml
<xacro:property name="radius" value="0.1"/>

<xacro:macro name="wheel_link" params="prefix">
    <link name="${prefix}_wheel_link">
        <geometry>
            <cylinder radius="${radius}" length="0.05"/>
        </geometry>
    </link>
</xacro:macro>

<xacro:wheel_link prefix="left"/>
<xacro:wheel_link prefix="right"/>
```

### 4. RViz 显示

```python
# display_robot.launch.py 核心组件
robot_description_content = Command(['xacro ', LaunchConfiguration('model')])

Node(package='robot_state_publisher', executable='robot_state_publisher',
     parameters=[{'robot_description': robot_description_content}])
Node(package='joint_state_publisher', executable='joint_state_publisher')
Node(package='rviz2', executable='rviz2')
```

### 5. Gazebo 仿真

```python
# gazebo_sim.launch.py 核心组件
# 1. 启动 Gazebo
IncludeLaunchDescription(gazebo.launch.py, launch_arguments=[('world', world_path)])

# 2. 生成机器人
Node(package='gazebo_ros', executable='spawn_entity.py',
     arguments=['-entity', 'fishbot', '-topic', 'robot_description'])

# 3. 按顺序加载控制器
ExecuteProcess(cmd=['ros2', 'control', 'load_controller',
                     'fishbot_joint_state_broadcaster', '--set-state', 'active'])
ExecuteProcess(cmd=['ros2', 'control', 'load_controller',
                     'fishbot_diff_drive_controller', '--set-state', 'active'])
```

### 6. 仿真启动流水线

```
xacro模型 → robot_state_publisher → Gazebo启动 → spawn_entity
    → 加载 JointStateBroadcaster → 加载 DiffDriveController
```

---

# 第三阶段：自主导航实战

---

## CHAT7 — Navigation2 导航与自主巡逻

### 1. Nav2 核心概念

| 概念 | 说明 |
|------|------|
| AMCL | 自适应蒙特卡洛定位 |
| Costmap | 代价地图（全局+局部） |
| Planner | 全局路径规划 |
| Controller | 局部路径跟踪 |
| BT | Behavior Tree（行为树） |

### 2. Nav2 参数配置结构

```
nav2_params.yaml
├── amcl              — 定位参数
├── bt_navigator      — 行为树配置
├── planner_server    — 全局规划器
├── controller_server — 局部控制器
├── local_costmap     — 局部代价地图
├── global_costmap    — 全局代价地图
└── waypoint_follower — 航点追踪
```

### 3. BasicNavigator API

```python
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult

nav = BasicNavigator()

# 等待激活
nav.waitUntilNav2Active()

# 设置初始位姿
nav.setInitialPose(pose)

# 导航到目标
nav.goToPose(goal_pose)

# 等待完成
while not nav.isTaskComplete():
    feedback = nav.getFeedback()
    print(f"距离: {feedback.distance_remaining}")

result = nav.getResult()  # SUCCEEDED / CANCELED / FAILED
```

### 4. 获取机器人位姿

```python
class GetRobotPose(Node):
    def __init__(self):
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)

    def get_transform(self):
        result = self.tf_buffer.lookup_transform("map", "base_footprint", rclpy.time.Time())
        x = result.transform.translation.x
        y = result.transform.translation.y
        roll, pitch, yaw = euler_from_quaternion([...])
```

### 5. 自主巡逻节点

```python
class PartolNode(Node):
    def __init__(self):
        self.navigator = BasicNavigator()
        self.waypoints = []  # 航点列表
        self.current_waypoint_index = 0
        self.timer = self.create_timer(1.0, self.navigate_to_waypoint)

    def navigate_to_waypoint(self):
        if self.navigator.isTaskComplete():
            self.current_waypoint_index += 1
            if self.current_waypoint_index < len(self.waypoints):
                self.navigator.goToPose(self.waypoints[self.current_waypoint_index])
        else:
            feedback = self.navigator.getFeedback()
```

### 6. 常用坐标系

```
map → odom → base_footprint → base_link → laser/camera
```

---

## CHAT8 — Nav2 自定义插件（C++ / pluginlib）

### 1. pluginlib 工作流

```
 定义抽象接口  →  实现具体插件  →  注册插件  →  编写XML  →  动态加载
 (纯虚基类)      (派生类)      (EXPORT宏)    (描述文件)    (ClassLoader)
```

### 2. 抽象接口定义

```cpp
namespace motion_control_system {
    class MotionControlInterface {
    public:
        virtual void start() = 0;
        virtual void stop() = 0;
        virtual void move(double linear, double angular) = 0;
    };
}
```

### 3. 具体插件实现

```cpp
class SpinMotionController : public MotionControlInterface {
    void start() override { spin(); }
private:
    void spin() { std::cout << "Robot is spinning!" << std::endl; }
};

// 注册插件
PLUGINLIB_EXPORT_CLASS(SpinMotionController, MotionControlInterface)
```

### 4. 动态加载

```cpp
pluginlib::ClassLoader<MotionControlInterface> loader("motion_control_system",
    "motion_control_system::MotionControlInterface");
auto controller = loader.createUniqueInstance("motion_control_system/SpinMotionController");
controller->start();
```

### 5. 自定义全局规划器（nav2_custom_planner）

```cpp
class CustomPlanner : public nav2_core::GlobalPlanner {
    nav_msgs::msg::Path createPlan(const PoseStamped &start, const PoseStamped &goal) override {
        // 1. 线性插值生成路径点
        int total = std::round(
            std::hypot(goal.pose.position.x - start.pose.position.x,
                       goal.pose.position.y - start.pose.position.y) /
            interpolation_resolution_);

        for (int i = 0; i < total; i++) {
            pose.pose.position.x = start.pose.position.x + i * dx;
            pose.pose.position.y = start.pose.position.y + i * dy;
            global_path.poses.push_back(pose);
        }

        // 2. 代价地图碰撞检测
        for (auto &pose : global_path.poses) {
            unsigned char cost = costmap_->getCost(mx, my);
            if (cost == LETHAL_OBSTACLE || cost == NO_INFORMATION)
                return global_path;  // 路径不可行
        }
        return global_path;
    }
};
PLUGINLIB_EXPORT_CLASS(nav2_custom_planner::CustomPlanner, nav2_core::GlobalPlanner)
```

### 6. 自定义局部控制器（nav_custom_controller）

```cpp
class CustomController : public nav2_core::Controller {
    TwistStamped computeVelocityCommands(const PoseStamped &pose, ...) override {
        // 1. 找最近路径点
        auto target_pose = getNearestTargetPose(pose_in_goalframe);

        // 2. 计算角度差
        double angle_diff = calculateAngleDifference(pose_in_goalframe, target_pose);

        // 3. 旋转/直行策略
        if (fabs(angle_diff) > M_PI / 10.0) {
            cmd_vel.twist.linear.x = 0.0;                    // 原地旋转
            cmd_vel.twist.angular.z = max_angular_speed_;
        } else {
            cmd_vel.twist.linear.x = max_linear_speed_;       // 直行
            cmd_vel.twist.angular.z = 0.0;
        }
        return cmd_vel;
    }
};
PLUGINLIB_EXPORT_CLASS(CustomController, nav2_core::Controller)
```

### 7. Nav2 参数集成自定义插件

```yaml
# nav2_params.yaml
planner_server:
  ros__parameters:
    planner_plugins: ["GridBased"]
    GridBased:
      plugin: "nav2_custom_planner/CustomPlanner"

controller_server:
  ros__parameters:
    controller_plugins: ["FollowPath"]
    FollowPath:
      plugin: "nav2_custom_controller::CustomController"
```

---

# 知识体系总览

## 核心通信机制对比

| 机制 | 模型 | 方向 | 类型 | 章节 |
|------|------|------|------|------|
| Topic | Publish/Subscribe | 单向 | 异步 | CHAPT3 |
| Service | Request/Response | 双向 | 同步/异步 | CHAT4 |
| Parameters | Key/Value | 双向 | 同步 | CHAT4 |
| TF Transform | 坐标广播/监听 | 单向 | 异步 | CHAT5 |

## 关键库与工具

| 库/工具 | 用途 | 章节 |
|---------|------|------|
| `rclpy` | Python ROS2客户端库 | 全部 |
| `nav2_simple_commander` | Nav2简单导航API | CHAT7, CHAT8 |
| `tf2_ros` | 坐标变换 | CHAT5, CHAT7 |
| `tf_transformations` | 欧拉角/四元数转换 | CHAT5, CHAT7 |
| `cv_bridge` | ROS图像↔OpenCV | CHAT4, CHAT7, CHAT8 |
| `pluginlib` | C++动态插件加载 | CHAT8 |
| `nav2_core` | Nav2插件接口 | CHAT8 |

## 完整启动流程（综合实战）

```
终端1: ros2 launch fishbot_description gazebo_sim.launch.py       # Gazebo仿真 (CHAT6)
终端2: ros2 launch fishbot_navigation2 navigtion2.launch.py        # Nav2导航  (CHAT7/8)
终端3: ros2 run autopartol_robot partol_node                        # 自主巡逻  (CHAT7/8)
       ros2 service call /speak_text ... "{text: 'hello'}"         # 语音播报  (CHAT4)
```

## 常用命令汇总

```bash
# === 编译 ===
colcon build                                          # 全量编译
colcon build --packages-select <pkg1> <pkg2>          # 选择性编译

# === 运行 ===
ros2 run <package> <executable>
ros2 launch <package> <launch_file>

# === 调试 ===
ros2 topic list                        # 查看所有话题
ros2 topic echo <topic>                # 查看话题数据
ros2 service list                      # 查看所有服务
ros2 service call <svc> <type> <data>  # 调用服务
ros2 param list                        # 查看所有参数
ros2 run tf2_ros tf_echo <p> <c>       # 查看TF变换
ros2 run tf2_ros view_frames           # 生成TF树

# === Gazebo / 控制器 ===
ros2 control list_controllers          # 列出控制器
ros2 control load_controller <name>    # 加载控制器
```

---

## 全部文件索引

| 文件 | 功能 | 章节 |
|------|------|------|
| `demo_python_pkg/python_node.py` | 最简单节点 | CHAPT2 |
| `demo_python_pkg/person_node.py` | 类继承节点 | CHAPT2 |
| `demo_python_pkg/learn_thread.py` | 多线程下载 | CHAPT2 |
| `demo_python_topic/novel_pub_node.py` | 小说发布端 | CHAPT3 |
| `demo_python_topic/novel_sub_node.py` | 小说朗读订阅端 | CHAPT3 |
| `demo_python_topic/turtle_control.py` | PID海龟控制 | CHAPT3 |
| `Partol.srv` | 巡逻服务接口定义 | CHAT4 |
| `demo_python_service/face_detect_node.py` | 人脸检测 | CHAT4 |
| `demo_python_service/launch.py` | Launch整合启动 | CHAT4 |
| `demo_python_tf/static_tf_broadcaster.py` | 静态TF广播 | CHAT5 |
| `demo_python_tf/dynamic_tf_broadcaster.py` | 动态TF广播 | CHAT5 |
| `demo_python_tf/tf_listener.py` | TF监听查询 | CHAT5 |
| `fishbot_description/urdf/fishbot.urdf.xacro` | fishbot模型 | CHAT6 |
| `fishbot_description/launch/display_robot.launch.py` | RViz显示启动 | CHAT6 |
| `fishbot_description/launch/gazebo_sim.launch.py` | Gazebo仿真启动 | CHAT6 |
| `fishbot_description/config/fishbot_ros2_controller.yaml` | 控制器配置 | CHAT6 |
| `fishbot_navigation2/config/nav2_params.yaml` | Nav2参数 | CHAT7,8 |
| `fishbot_application/init_robot_pose.py` | 初始位姿设置 | CHAT7 |
| `autopartol_robot/partol_node.py` | 巡逻主节点 | CHAT7,8 |
| `autopartol_interfaces/srv/SpeechText.srv` | 语音服务 | CHAT7,8 |
| `nav2_custom_planner/src/nav2_custom_planner.cpp` | 自定义全局规划器 | CHAT8 |
| `nav_custom_controller/src/custom_controller.cpp` | 自定义局部控制器 | CHAT8 |
| `learn_pluginlib/motion_control_system/` | pluginlib学习例程 | CHAT8 |
