
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Typography } from 'antd';
import {
  DashboardOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
  NodeIndexOutlined,
  FundProjectionScreenOutlined,
  MonitorOutlined,
  SecurityScanOutlined,
  UserSwitchOutlined,
  AuditOutlined,
  BarChartOutlined,
  HeatMapOutlined,
  FileSearchOutlined,
  PhoneOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  {
    key: 'federated',
    icon: <CloudServerOutlined />,
    label: '强化联邦学习原型系统',
    children: [
      { key: '/federated/user-control', icon: <DashboardOutlined />, label: '用户控制层' },
      { key: '/federated/edge-control', icon: <ClusterOutlined />, label: '边缘计算控制层' },
      { key: '/federated/cloud-control', icon: <SafetyCertificateOutlined />, label: '云中心控制层' },
    ],
  },
  {
    key: 'computing',
    icon: <FundProjectionScreenOutlined />,
    label: '算力网络智能调度',
    children: [
      { key: '/computing/resource-sensing', icon: <NodeIndexOutlined />, label: '多维资源协同感知' },
      { key: '/computing/task-management', icon: <AlertOutlined />, label: '算力任务运营调度' },
      { key: '/computing/prediction-allocation', icon: <FundProjectionScreenOutlined />, label: '协同预测与分配' },
      { key: '/computing/resource-monitoring', icon: <MonitorOutlined />, label: '算力资源实时监控' },
      { key: '/computing/security-assessment', icon: <SecurityScanOutlined />, label: '量化安全性评估' },
    ],
  },
  {
    key: 'fraud',
    icon: <AlertOutlined />,
    label: '电信欺诈识别系统',
    children: [
      { key: '/fraud/user-identification', icon: <UserSwitchOutlined />, label: '诈骗用户识别' },
      { key: '/fraud/behavior-tracking', icon: <AuditOutlined />, label: '异常行为追踪' },
      { key: '/fraud/data-analysis', icon: <BarChartOutlined />, label: '诈骗数据分析' },
      { key: '/fraud/situation-analysis', icon: <HeatMapOutlined />, label: '诈骗态势分析' },
      { key: '/fraud/text-mining', icon: <FileSearchOutlined />, label: '文本数据挖掘' },
      { key: '/fraud/communication-mining', icon: <PhoneOutlined />, label: '通信数据挖掘' },
    ],
  },
];

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // Determine open keys from path
  const pathSegments = location.pathname.split('/');
  const openKey = pathSegments[1] || 'federated';

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={260}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 16px',
        }}>
          <Title level={5} style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {collapsed ? 'FL' : '强化联邦学习系统'}
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={[openKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, paddingTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: token.colorBgContainer,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          height: 64,
        }}>
          <Title level={4} style={{ margin: 0 }}>
            强化联邦学习原型系统与典型应用
          </Title>
        </Header>
        <Content style={{
          margin: 16,
          padding: 20,
          background: token.colorBgLayout,
          overflow: 'auto',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
