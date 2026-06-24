---
title: "ROS2 机器人建模与仿真"
date: 2026-06-21
tags: ["ROS2", "仿真", "学习笔记"]
summary: "CHAT6 学习笔记：URDF/Xacro 模型、RViz 可视化、Gazebo 仿真、ros2_control 控制器。"
---

# CHAT6 ROS2 机器人模型与仿真学习笔记

> 机器人URDF/Xacro模型、RViz显示、Gazebo仿真启动

---

## 一、ROS2 机器人模型概述

### 常用文件格式

| 格式 | 说明 | 用途 |
|------|------|------|
| `.urdf` | Unified Robot Description Format | 机器人统一描述格式 |
| `.xacro` | XML Macro | 可参数化的URDF模板 |
| `.world` | Gazebo World File | 仿真环境文件 |

### 常用标签

```xml
<link>     # 机器人 link（刚体）
<joint>   # 机器人关节
<robot>   # 根标签
<gazebo>  # Gazebo 仿真配置
```

---

## 二、URDF 机器人模型

### 2.1 基本结构

```xml
<?xml version="1.0"?>
<robot name="fishbot">
    <!-- 基础 link -->
    <link name="base_link">
        <inertial>
            <mass value="1.0"/>
            <origin xyz="0 0 0" rpy="0 0 0"/>
        </inertial>
        <visual>
            <origin xyz="0 0 0" rpy="0 0 0"/>
            <geometry>
                <cylinder length="0.3" radius="0.1"/>
            </geometry>
        </visual>
        <collision>
            <origin xyz="0 0 0" rpy="0 0 0"/>
            <geometry>
                <cylinder length="0.3" radius="0.1"/>
            </geometry>
        </collision>
    </link>
    
    <!-- 关节 -->
    <joint name="joint_name" type="continuous">
        <parent link="parent_link"/>
        <child link="child_link"/>
        <origin xyz="0 0 0" rpy="0 0 0"/>
        <axis xyz="0 1 0"/>
    </joint>
</robot>
```

### 2.2 标签说明

| 标签 | 说明 |
|------|------|
| `inertial` | 惯性参数（质量、质心、惯性矩） |
| `visual` | 可视化外观 |
| `collision` | 碰撞检测几何体 |
| `origin` | 相对父坐标系的位姿 |
| `axis` | 关节旋转轴 |

### 2.3 关节类型

| 类型 | 说明 |
|------|------|
| `revolute` | 旋转关节（有角度限制） |
| `continuous` | 连续旋转关节（无限制） |
| `prismatic` | 移动关节（直线） |
| `fixed` | 固定关节 |
| `floating` | 浮动关节 |
| `planar` | 平面关节 |

---

## 三、Xacro 模板

### 3.1 基本语法

```xml
<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
    <!-- 参数定义 -->
    <xacro:property name="PI" value="3.14159"/>
    <xacro:property name="radius" value="0.1"/>
    <xacro:property name="length" value="0.3"/>
    
    <!-- 宏定义 -->
    <xacro:macro name="wheel_link" params="prefix">
        <link name="${prefix}_wheel_link">
            <visual>
                <geometry>
                    <cylinder radius="${radius}" length="0.05"/>
                </geometry>
            </visual>
        </link>
    </xacro:macro>
    
    <!-- 调用宏 -->
    <xacro:wheel_link prefix="left"/>
    <xacro:wheel_link prefix="right"/>
</robot>
```

### 3.2 常用语法

```xml
<!-- 变量引用 -->
${variable}

<!-- 数学运算 -->
${PI / 2}
${radius * 2}

<!-- 条件判断 -->
<xacro:if value="${prefix == 'left'}">
</xacro:if>
```

### 3.3 命令行转换

```bash
# xacro 转 urdf
xacro model.xacro > model.urdf

# 带参数转换
xacro model.xacro param:=value > model.urdf
```

---

## 四、RViz 机器人显示

### 4.1 display_robot.launch.py

```python
import launch
import launch_ros
from ament_index_python.packages import get_package_share_directory
import os

def generate_launch_description():
    urdf_file = get_package_share_directory('fishbot_description')
    default_urdf_path = os.path.join(urdf_file, "urdf", 'first_robot.urdf')
    default_rviz_config_path = os.path.join(urdf_file, "config", 'display_robot_model.rviz')
    
    action_declare_mode_path = launch.actions.DeclareLaunchArgument(
        name='model',
        default_value=str(default_urdf_path),
        description='加载模型urdf文件路径'
    )
    
    robot_description_content = launch.substitutions.Command(
        ['xacro ', launch.substitutions.LaunchConfiguration('model')]
    )
    
    action_robot_state_publisher = launch_ros.actions.Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        parameters=[{'robot_description': robot_description_content}],
    )
    
    action_joint_state_publisher = launch_ros.actions.Node(
        package='joint_state_publisher',
        executable='joint_state_publisher',
    )
    
    action_rviz2 = launch_ros.actions.Node(
        package='rviz2',
        executable='rviz2',
        arguments=['-d', default_rviz_config_path]
    )
    
    return launch.LaunchDescription([
        action_declare_mode_path,
        action_robot_state_publisher,
        action_joint_state_publisher,
        action_rviz2,
    ])
```

### 4.2 关键节点

| 节点 | 功能 |
|------|------|
| `robot_state_publisher` | 发布机器人状态（TF变换） |
| `joint_state_publisher` | 发布关节角度 |
| `rviz2` | 可视化显示 |

### 4.3 启动命令

```bash
# 启动显示
ros2 launch fishbot_description display_robot.launch.py

# 指定模型文件
ros2 launch fishbot_description display_robot.launch.py model:=/path/to/model.urdf
```

---

## 五、Gazebo 仿真

### 5.1 gazebo_sim.launch.py

```python
import launch
import launch_ros
from ament_index_python.packages import get_package_share_directory
import os
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.event_handlers import OnProcessExit

def generate_launch_description():
    urdf_file = get_package_share_directory('fishbot_description')
    default_xacro_path = os.path.join(urdf_file, "urdf", 'fishbot/fishbot.urdf.xacro')
    default_gazebo_world_path = os.path.join(urdf_file, "world", 'custom_room.world')
    
    action_declare_mode_path = launch.actions.DeclareLaunchArgument(
        name='model',
        default_value=str(default_xacro_path),
        description='加载模型xacro文件路径'
    )
    
    robot_description_content = launch.substitutions.Command(
        ['xacro ', launch.substitutions.LaunchConfiguration('model')]
    )
    
    action_robot_state_publisher = launch_ros.actions.Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        parameters=[{'robot_description': robot_description_content}],
    )
    
    action_launch_gazebo = launch.actions.IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('gazebo_ros'), 'launch', 'gazebo.launch.py')
        ),
        launch_arguments=[
            ('world', default_gazebo_world_path),
            ('verbose', 'true'),
        ]
    )
    
    action_spawn_entity = launch_ros.actions.Node(
        package='gazebo_ros',
        executable='spawn_entity.py',
        arguments=[
            '-entity', 'fishbot',
            '-topic', 'robot_description',
        ],
        output='screen'
    )
    
    action_load_joint_controller = launch.actions.ExecuteProcess(
        cmd=[
            'ros2', 'control', 'load_controller',
            'fishbot_joint_state_broadcaster',
            '--set-state', 'active'
        ],
        output='screen'
    )
    
    action_load_diff_drive_controller = launch.actions.ExecuteProcess(
        cmd=[
            'ros2', 'control', 'load_controller',
            'fishbot_diff_drive_controller',
            '--set-state', 'active'
        ],
        output='screen'
    )
    
    return launch.LaunchDescription([
        action_declare_mode_path,
        action_robot_state_publisher,
        action_launch_gazebo,
        action_spawn_entity,
        launch.actions.RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=action_spawn_entity,
                on_exit=[action_load_joint_controller],
            )
        ),
        launch.actions.RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=action_load_joint_controller,
                on_exit=[action_load_diff_drive_controller],
            )
        ),
    ])
```

### 5.2 关键组件

| 组件 | 功能 |
|------|------|
| `gazebo.launch.py` | 启动Gazebo仿真器 |
| `spawn_entity.py` | 在Gazebo中生成机器人 |
| `robot_state_publisher` | 发布TF变换 |
| 控制器加载 | 加载关节状态和运动控制器 |

### 5.3 Gazebo 相关配置

```xml
<!-- Gazebo 摩擦力配置 -->
<gazebo reference="link_name">
    <mu1>0.9</mu1>
    <mu2>0.9</mu2>
    <material>Gazebo/Gray</material>
</gazebo>

<!-- Gazebo 阻尼配置 -->
<gazebo reference="joint_name">
    <dynamics>
        <damping>1.0</damping>
        <friction>1.0</friction>
    </dynamics>
</gazebo>
```

### 5.4 启动命令

```bash
# 启动仿真
ros2 launch fishbot_description gazebo_sim.launch.py

# 带参数启动
ros2 launch fishbot_description gazebo_sim.launch.py model:=/path/to/model.xacro
```

---

## 六、ros2_control 控制器

### 6.1 控制器配置

```yaml
fishbot_joint_state_broadcaster:
  type: joint_state_broadcaster/JointStateBroadcaster

fishbot_diff_drive_controller:
  type: diff_drive_controller/DiffDriveController
  base_frame_id: base_link
  wheels_separation: 0.2
  wheel_radius: 0.05
  left_wheel_names: ["left_wheel_joint"]
  right_wheel_names: ["right_wheel_joint"]
```

### 6.2 手动加载控制器

```bash
# 加载关节状态广播器
ros2 control load_controller fishbot_joint_state_broadcaster --set-state active

# 加载差速驱动控制器
ros2 control load_controller fishbot_diff_drive_controller --set-state active
```

### 6.3 常用命令

```bash
# 列出控制器
ros2 control list_controllers

# 查看控制器状态
ros2 control list_hardware_components

# 发送速度命令
ros2 topic pub /diff_drive_controller/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.1, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}"
```

---

## 七、常用命令汇总

```bash
# 查看功能包目录
ros2 pkg prefix fishbot_description

# 启动机器人显示
ros2 launch fishbot_description display_robot.launch.py

# 启动Gazebo仿真
ros2 launch fishbot_description gazebo_sim.launch.py

# xacro转urdf
xacro /path/to/model.xacro > model.urdf

# 控制器操作
ros2 control load_controller <name> --set-state active
ros2 control unload_controller <name>
```

---

## 八、文件索引

| 文件 | 功能 |
|------|------|
| `urdf/first_robot.urdf` | 基础机器人模型 |
| `urdf/fishbot/fishbot.urdf.xacro` | fishbot模型 |
| `launch/display_robot.launch.py` | RViz显示启动文件 |
| `launch/gazebo_sim.launch.py` | Gazebo仿真启动文件 |
| `config/fishbot_ros2_controller.yaml` | 控制器配置 |
| `world/custom_room.world` | 仿真环境 |
| `config/display_robot_model.rviz` | RViz配置 |