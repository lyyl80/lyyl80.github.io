---
title: "Nav2 自定义规划器与插件化"
date: 2026-06-23
tags: ["ROS2", "导航", "学习笔记"]
summary: "CHAT8 学习笔记：pluginlib 框架、自定义全局规划器、局部控制器、自主巡逻应用。"
---

# CHAT8 ROS2 导航自定义与插件化学习笔记

> Navigation2自定义规划器/控制器、pluginlib插件框架、自主巡逻综合应用

---

## 一、Nav2 插件化概述

### 常用概念

| 概念 | 说明 |
|------|------|
| GlobalPlanner | 全局路径规划器接口 |
| Controller | 局部路径控制器接口 |
| pluginlib | 动态加载插件库的C++框架 |
| LifecycleNode | 生命周期管理节点 |
| Costmap | 代价地图（障碍物表示） |
| Plugin XML | 插件注册描述文件 |

### Nav2 可扩展的插件类型

| 插件类型 | 接口 | 说明 |
|----------|------|------|
| Global Planner | `nav2_core::GlobalPlanner` | 全局路径规划 |
| Controller | `nav2_core::Controller` | 局部路径跟踪 |
| Behavior | `nav2_core::Behavior` | 恢复行为 |
| Smoother | `nav2_core::Smoother` | 路径平滑 |
| Goal Checker | `nav2_core::GoalChecker` | 到达检查 |
| Waypoint Task | `nav2_core::WaypointTaskExecutor` | 航点任务执行 |

---

## 二、pluginlib 插件框架

### 2.1 工作流程

```
定义抽象接口 → 实现具体插件 → 注册插件(PLUGINLIB_EXPORT_CLASS)
    → 编写XML描述文件 → 动态加载(pluginlib::ClassLoader)
```

### 2.2 抽象接口定义

```cpp
// motion_control_interface.hpp
namespace motion_control_system
{
    class MotionControlInterface
    {
    public:
        virtual void start() = 0;
        virtual void stop() = 0;
        virtual void move(double linear_velocity, double angular_velocity) = 0;
    };
}
```

### 2.3 插件实现与注册

```cpp
// spin_motion_controller.cpp
namespace motion_control_system
{
    class SpinMotionController : public MotionControlInterface
    {
        void start() override { spin(); }
        void stop() override {}
        void move(double linear, double angular) override {
            if (angular != 0.0) spin();
        }
    private:
        void spin() { std::cout << "Robot is spinning in place!" << std::endl; }
    };
}
// 注册插件
PLUGINLIB_EXPORT_CLASS(motion_control_system::SpinMotionController,
                       motion_control_system::MotionControlInterface)
```

```cpp
// street_motion_controller.cpp
namespace motion_control_system
{
    class StreetMotionController : public MotionControlInterface
    {
        void start() override {}
        void stop() override {}
        void move(double linear, double angular) override {
            driveStraight();
        }
    private:
        void driveStraight() {
            std::cout << "StreetMotionController is driving straight." << std::endl;
        }
    };
}
PLUGINLIB_EXPORT_CLASS(motion_control_system::StreetMotionController,
                       motion_control_system::MotionControlInterface)
```

### 2.4 插件XML描述文件

```xml
<!-- spin_motion_pluginlib.xml -->
<library path="spin_motion_controller">
    <class name="motion_control_system/SpinMotionController"
           type="motion_control_system::SpinMotionController"
           base_class_type="motion_control_system::MotionControlInterface">
        <description>A motion controller that makes the robot spin in place.</description>
    </class>
</library>
```

```xml
<!-- street_motion_pluginlib.xml -->
<library path="street_motion_controller">
    <class name="motion_control_system/StreetMotionController"
           type="motion_control_system::StreetMotionController"
           base_class_type="motion_control_system::MotionControlInterface">
        <description>A motion controller that makes the robot move in a straight line.</description>
    </class>
</library>
```

### 2.5 动态加载插件

```cpp
#include <pluginlib/class_loader.hpp>

int main(int argc, char **argv)
{
    // 1. 创建插件加载器（包名，基类全限定名）
    pluginlib::ClassLoader<motion_control_system::MotionControlInterface>
        controller_loader("motion_control_system",
                          "motion_control_system::MotionControlInterface");

    // 2. 按名称加载插件
    auto controller = controller_loader.createUniqueInstance(argv[1]);

    // 3. 调用插件方法
    controller->start();
    controller->stop();
}
```

### 2.6 编译配置（CMakeLists.txt 关键部分）

```cmake
pluginlib_export_plugin_description_file(motion_control_system spin_motion_pluginlib.xml)
pluginlib_export_plugin_description_file(motion_control_system street_motion_pluginlib.xml)
```

### 2.7 运行测试

```bash
# 加载 SpinMotionController
ros2 run motion_control_system test_plugin motion_control_system/SpinMotionController

# 加载 StreetMotionController
ros2 run motion_control_system test_plugin motion_control_system/StreetMotionController
```

---

## 三、自定义全局规划器（nav2_custom_planner）

### 3.1 头文件

```cpp
#include "nav2_core/global_planner.hpp"
#include "nav2_costmap_2d/costmap_2d_ros.hpp"

namespace nav2_custom_planner
{
class CustomPlanner : public nav2_core::GlobalPlanner
{
public:
    void configure(const rclcpp_lifecycle::LifecycleNode::WeakPtr &parent,
                   std::string name, std::shared_ptr<tf2_ros::Buffer> tf,
                   std::shared_ptr<nav2_costmap_2d::Costmap2DROS> costmap_ros) override;
    void cleanup() override;
    void activate() override;
    void deactivate() override;
    nav_msgs::msg::Path createPlan(const geometry_msgs::msg::PoseStamped &start,
                                   const geometry_msgs::msg::PoseStamped &goal) override;
private:
    nav2_util::LifecycleNode::SharedPtr node_;
    nav2_costmap_2d::Costmap2D *costmap_;
    std::string global_frame_, name_;
    double interpolation_resolution_;
};
}
```

### 3.2 核心规划逻辑

```cpp
nav_msgs::msg::Path CustomPlanner::createPlan(const PoseStamped &start,
                                               const PoseStamped &goal)
{
    nav_msgs::msg::Path global_path;
    global_path.header.frame_id = global_frame_;

    // 1. 校验坐标系
    if (start.header.frame_id != global_frame_ || goal.header.frame_id != global_frame_)
        return global_path;

    // 2. 线性插值生成路径点
    int total_points = std::round(
        std::hypot(goal.pose.position.x - start.pose.position.x,
                   goal.pose.position.y - start.pose.position.y) /
        interpolation_resolution_);
    double dx = (goal.pose.position.x - start.pose.position.x) / total_points;
    double dy = (goal.pose.position.y - start.pose.position.y) / total_points;

    for (int i = 0; i < total_points; i++)
    {
        geometry_msgs::msg::PoseStamped pose;
        pose.header.frame_id = global_frame_;
        pose.pose.position.x = start.pose.position.x + i * dx;
        pose.pose.position.y = start.pose.position.y + i * dy;
        global_path.poses.push_back(pose);
    }

    // 3. 代价地图碰撞检测
    for (auto &pose : global_path.poses)
    {
        unsigned int mx, my;
        if (costmap_->worldToMap(pose.pose.position.x, pose.pose.position.y, mx, my))
        {
            unsigned char cost = costmap_->getCost(mx, my);
            if (cost == nav2_costmap_2d::NO_INFORMATION ||
                cost == nav2_costmap_2d::LETHAL_OBSTACLE)
            {
                RCLCPP_ERROR(node_->get_logger(), "路径点 (%f, %f) 不可行");
                return global_path;  // 返回空路径
            }
        }
    }

    // 4. 追加目标点
    global_path.poses.push_back(goal);
    return global_path;
}
```

### 3.3 插件注册与XML

```cpp
// 注册为Nav2全局规划器
PLUGINLIB_EXPORT_CLASS(nav2_custom_planner::CustomPlanner,
                       nav2_core::GlobalPlanner)
```

```xml
<!-- custom_planner_plugin.xml -->
<library path="nav2_custom_planner_plugin">
  <class name="nav2_custom_planner/CustomPlanner"
         type="nav2_custom_planner::CustomPlanner"
         base_class_type="nav2_core::GlobalPlanner">
    <description>自定义全局规划器</description>
  </class>
</library>
```

---

## 四、自定义局部控制器（nav_custom_controller）

### 4.1 头文件

```cpp
#include "nav2_core/controller.hpp"

namespace nav2_custom_controller
{
class CustomController : public nav2_core::Controller
{
public:
    void configure(...) override;
    void cleanup() override;
    void activate() override;
    void deactivate() override;
    geometry_msgs::msg::TwistStamped
    computeVelocityCommands(const PoseStamped &pose, const Twist &velocity,
                            nav2_core::GoalChecker *goal_checker) override;
    void setPlan(const nav_msgs::msg::Path &path) override;
    void setSpeedLimit(const double &speed_limit, const bool &percentage) override;

protected:
    std::string plugin_name_;
    nav_msgs::msg::Path global_plan_;
    double max_linear_speed_, max_angular_speed_;

    PoseStamped getNearestTargetPose(const PoseStamped &current_pose);
    double calculateAngleDifference(const PoseStamped &current_pose,
                                    const PoseStamped &target_pose);
};
}
```

### 4.2 核心控制逻辑 — 旋转/直行策略

```cpp
geometry_msgs::msg::TwistStamped
CustomController::computeVelocityCommands(
    const PoseStamped &pose, const Twist &, GoalChecker *)
{
    if (global_plan_.poses.empty())
        throw nav2_core::PlannerException("收到长度为零的路径");

    // 变换机器人位姿到全局坐标系
    PoseStamped pose_in_goalframe;
    nav2_util::transformPoseInTargetFrame(pose, pose_in_goalframe,
                                          *tf_, global_plan_.header.frame_id, 0.1);

    // 获取最近目标点并计算角度差
    auto target_pose = getNearestTargetPose(pose_in_goalframe);
    double angle_diff = calculateAngleDifference(pose_in_goalframe, target_pose);

    geometry_msgs::msg::TwistStamped cmd_vel;
    cmd_vel.header.frame_id = pose_in_goalframe.header.frame_id;

    // 策略：角度差 > 18° 则原地旋转，否则直行
    if (fabs(angle_diff) > M_PI / 10.0)
    {
        cmd_vel.twist.linear.x = 0.0;
        cmd_vel.twist.angular.z = fabs(angle_diff) / angle_diff * max_angular_speed_;
    }
    else
    {
        cmd_vel.twist.linear.x = max_linear_speed_;
        cmd_vel.twist.angular.z = 0.0;
    }
    return cmd_vel;
}
```

### 4.3 辅助方法

```cpp
PoseStamped CustomController::getNearestTargetPose(const PoseStamped &current_pose)
{
    // 找到路径上距离当前点最近的点
    size_t nearest_idx = 0;
    double min_dist = euclidean_distance(current_pose, global_plan_.poses[0]);
    for (size_t i = 1; i < global_plan_.poses.size(); ++i) {
        double dist = euclidean_distance(current_pose, global_plan_.poses[i]);
        if (dist < min_dist) { min_dist = dist; nearest_idx = i; }
    }
    // 擦除已走过的路径段
    global_plan_.poses.erase(global_plan_.poses.begin(),
                             global_plan_.poses.begin() + nearest_idx);
    // 返回下一个目标点
    return (global_plan_.poses.size() == 1) ?
           global_plan_.poses[0] : global_plan_.poses[1];
}

double CustomController::calculateAngleDifference(
    const PoseStamped &current, const PoseStamped &target)
{
    double current_yaw = tf2::getYaw(current.pose.orientation);
    double target_yaw = std::atan2(
        target.pose.position.y - current.pose.position.y,
        target.pose.position.x - current.pose.position.x);
    double diff = target_yaw - current_yaw;
    if (diff > M_PI) diff -= 2 * M_PI;
    if (diff < -M_PI) diff += 2 * M_PI;
    return diff;
}
```

### 4.4 插件注册与XML

```cpp
PLUGINLIB_EXPORT_CLASS(nav2_custom_controller::CustomController,
                       nav2_core::Controller)
```

```xml
<!-- nav2_custom_controller.xml -->
<class_libraries>
    <library path="nav_custom_controller_plugin">
        <class type="nav2_custom_controller::CustomController"
               base_class_type="nav2_core::Controller">
            <description>自定义导航控制器</description>
        </class>
    </library>
</class_libraries>
```

---

## 五、Nav2 参数配置（集成自定义插件）

### 5.1 规划器配置

```yaml
planner_server:
  ros__parameters:
    planner_plugins: ["GridBased"]
    GridBased:
      plugin: "nav2_custom_planner/CustomPlanner"
      interpolation_resolution: 0.1
```

### 5.2 控制器配置

```yaml
controller_server:
  ros__parameters:
    controller_plugins: ["FollowPath"]
    FollowPath:
      plugin: "nav2_custom_controller::CustomController"
      max_linear_speed: 0.1
      max_angular_speed: 1.0
```

### 5.3 代价地图配置

```yaml
local_costmap:
  local_costmap:
    ros__parameters:
      rolling_window: true
      width: 3
      height: 3
      resolution: 0.05
      plugins: ["voxel_layer", "inflation_layer"]

global_costmap:
  global_costmap:
    ros__parameters:
      global_frame: map
      resolution: 0.05
      plugins: ["static_layer", "obstacle_layer", "inflation_layer"]
```

### 5.4 完整导航启动

```bash
ros2 launch fishbot_navigation2 navigtion2.launch.py use_sim_time:=true
```

---

## 六、自主巡逻综合应用（autopartol_robot）

### 6.1 PartolNode 核心代码

```python
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseStamped
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
import tf_transformations
from autopartol_interfaces.srv import SpeechText
from sensor_msgs.msg import Image
from cv_bridge import CvBridge
import cv2, os
from datetime import datetime

class PartolNode(Node):
    def __init__(self):
        super().__init__('partol_node')
        # 参数声明
        self.declare_parameter('init_pose', [0.0, 0.0, 0.0])
        self.declare_parameter('waypoints_str',
            [0.0, 0.0, 0.0, -3.0, -2.0, 0.0, 3.0, 3.0, 0.0, 0.0, 0.0, 0.0])
        self.declare_parameter('image_path', './saved_images')

        self.navigator = BasicNavigator()
        self.waypoints = []
        self.create_waypoints_from_list(self.get_parameter('waypoints_str').value)
        self.current_waypoint_index = 0
        self.is_navigating = False
        self.timer = self.create_timer(1.0, self.navigate_to_waypoint)

        # 语音服务客户端
        self.speaker_client = self.create_client(SpeechText, 'speak_text')
        self.cv_bridge = CvBridge()
        self.laster_image = None
        self.image_subscription = self.create_subscription(
            Image, '/camera_sensor/image_raw', self.image_callback, 1)

    def create_waypoints_from_list(self, waypoints_list):
        for i in range(0, len(waypoints_list), 3):
            pose = PoseStamped()
            pose.header.frame_id = 'map'
            pose.pose.position.x = waypoints_list[i]
            pose.pose.position.y = waypoints_list[i + 1]
            q = tf_transformations.quaternion_from_euler(0, 0, waypoints_list[i + 2])
            pose.pose.orientation.x = q[0]
            pose.pose.orientation.y = q[1]
            pose.pose.orientation.z = q[2]
            pose.pose.orientation.w = q[3]
            self.waypoints.append(pose)

    def navigate_to_waypoint(self):
        if self.is_navigating:
            if not self.navigator.isTaskComplete():
                return
            else:
                self.is_navigating = False
                result = self.navigator.getResult()
                if result == TaskResult.SUCCEEDED:
                    self.speech_text_async(f'已到达航点 {self.current_waypoint_index + 1}')
                    self.save_image()
                    self.current_waypoint_index += 1
                    if self.current_waypoint_index >= len(self.waypoints):
                        self.current_waypoint_index = 0
                return

        if not self.waypoints:
            return
        self.navigator.goToPose(self.waypoints[self.current_waypoint_index])
        self.is_navigating = True
```

### 6.2 语音播报服务接口

```srv
# autopartol_interfaces/srv/SpeechText.srv
string text
---
bool result
```

### 6.3 巡逻配置文件

```yaml
/partol_node:
  ros__parameters:
    init_pose: [0.0, 0.0, 0.0]
    image_path: './saved_images'
    waypoints_str: [
      0.0, 0.0, 0.0,
      1.0, 2.0, 3.14,
      -4.5, 1.5, 1.57,
      -8.0, -5.0, 1.57,
      1.0, -5.0, 3.14
    ]
```

### 6.4 启动命令

```bash
# 完整系统启动（Gazebo + Nav2 + 巡逻 + Rviz2）
ros2 launch autopartol_robot autopartol_launch.py

# 单独启动巡逻节点
ros2 run autopartol_robot partol_node --ros-args \
    -p waypoints_str:="[0.0,0.0,0.0, 2.0,0.0,0.0, 2.0,2.0,0.0]"

# 调用语音服务
ros2 service call /speak_text autopartol_interfaces/srv/SpeechText \
    "{text: '到达巡逻点'}"
```

---

## 七、图像处理与保存

```python
def image_callback(self, msg):
    self.laster_image = self.cv_bridge.imgmsg_to_cv2(msg, 'bgr8')

def save_image(self):
    if self.laster_image is None:
        return
    os.makedirs(self.image_path, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'wp{self.current_waypoint_index+1:02d}_{timestamp}.jpg'
    filepath = os.path.join(self.image_path, filename)
    cv2.imwrite(filepath, self.laster_image)
```

---

## 八、常用命令汇总

```bash
# 测试pluginlib插件
ros2 run motion_control_system test_plugin motion_control_system/SpinMotionController
ros2 run motion_control_system test_plugin motion_control_system/StreetMotionController

# 构建工作空间
colcon build --packages-select nav2_custom_planner nav_custom_controller

# 启动导航（自定义规划器+控制器）
ros2 launch fishbot_navigation2 navigtion2.launch.py use_sim_time:=true

# 完整自主巡逻系统
ros2 launch autopartol_robot autopartol_launch.py

# 导航相关话题
ros2 topic list | grep -E "(nav|amcl|cmd_vel|plan)"

# 查看TF变换
ros2 run tf2_ros tf2_echo map base_footprint
```

---

## 九、文件索引

| 文件 | 功能 |
|------|------|
| `learn_pluginlib/motion_control_system/include/.../motion_control_interface.hpp` | pluginlib抽象接口 |
| `learn_pluginlib/motion_control_system/src/spin_motion_controller.cpp` | 旋转插件实现 |
| `learn_pluginlib/motion_control_system/src/street_motion_controller.cpp` | 直行插件实现 |
| `learn_pluginlib/motion_control_system/src/test_plugin.cpp` | 插件加载测试程序 |
| `nav2_custom_planner/src/nav2_custom_planner.cpp` | 自定义全局规划器 |
| `nav2_custom_planner/custom_planner_plugin.xml` | 规划器插件描述 |
| `nav_custom_controller/src/custom_controller.cpp` | 自定义局部控制器 |
| `nav_custom_controller/nav2_custom_controller.xml` | 控制器插件描述 |
| `fishbot_navigation2/config/nav2_params.yaml` | Nav2参数配置（含自定义插件） |
| `autopartol_robot/autopartol_robot/partol_node.py` | 巡逻主节点 |
| `autopartol_robot/config/partol_config.yaml` | 巡逻配置 |
| `autopartol_robot/launch/autopartol_launch.py` | 完整系统启动 |
| `autopartol_interfaces/srv/SpeechText.srv` | 语音服务定义 |
