import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Button, Table } from 'antd'
import { ShoppingCartOutlined, UserOutlined, CalendarOutlined, RiseOutlined } from '@ant-design/icons'

const SalesRepDashboard = () => {
  const [stats, setStats] = useState({
    totalOffers: 0,
    approvedOffers: 0,
    pendingOffers: 0,
    conversionRate: 0
  })
  
  const [offers, setOffers] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [statsRes, offersRes, customersRes] = await Promise.all([
        fetch('/api/dashboard/sales-rep/stats').then(r => r.json()),
        fetch('/api/dashboard/sales-rep/offers').then(r => r.json()),
        fetch('/api/dashboard/sales-rep/customers').then(r => r.json())
      ])
      
      setStats(statsRes.data)
      setOffers(offersRes.data)
      setCustomers(customersRes.data)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const dashboardTiles = [
    {
      title: 'Create New Preliminary Offer',
      description: 'Integrated NPV calculator with real-time validation',
      icon: <ShoppingCartOutlined />,
      action: () => window.location.href = '/offers/new',
      color: '#1890ff'
    },
    {
      title: 'My Offers Management',
      description: 'View and manage all your preliminary offers',
      icon: <CalendarOutlined />,
      action: () => window.location.href = '/offers',
      color: '#52c41a'
    },
    {
      title: 'Unit Block Requests',
      description: 'Request unit blocks for customer visits',
      icon: <UserOutlined />,
      action: () => window.location.href = '/blocks/request',
      color: '#faad14'
    },
    {
      title: 'Performance Metrics',
      description: 'Track your sales performance and achievements',
      icon: <RiseOutlined />,
      action: () => window.location.href = '/performance',
      color: '#722ed1'
    }
  ]

  return (
    <div className="sales-rep-dashboard">
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Offers" value={stats.totalOffers} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Approved Offers" value={stats.approvedOffers} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Pending Approval" value={stats.pendingOffers} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Conversion Rate" value={stats.conversionRate} suffix="%" valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {dashboardTiles.map((tile, index) => (
          <Col span={6} key={index}>
            <Card 
              hoverable 
              onClick={tile.action}
              style={{ height: '200px', cursor: 'pointer' }}
            >
              <div style={{ textAlign: 'center', color: tile.color }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>{tile.icon}</div>
                <h3>{tile.title}</h3>
                <p style={{ color: '#666' }}>{tile.description}</p>
                <Button type="primary" style={{ marginTop: '16px' }}>Access</Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="Recent Offers" extra={<a href="/offers">View All</a>}>
            <Table 
              dataSource={offers.slice(0, 5)}
              columns={[
                { title: 'Offer ID', dataIndex: 'id', key: 'id' },
                { title: 'Customer', dataIndex: 'customer_name', key: 'customer' },
                { title: 'Unit', dataIndex: 'unit_code', key: 'unit' },
                { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => (
                  <span style={{ 
                    color: status === 'approved' ? '#52c41a' : 
                           status === 'pending' ? '#faad14' : '#ff4d4f' 
                  }}>{status}</span>
                )},
                { title: 'Amount', dataIndex: 'total_amount', key: 'amount', render: (amount) => `EGP ${amount?.toLocaleString()}` }
              ]}
              pagination={false}
              loading={loading}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Quick Actions">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Button type="primary" block size="large" onClick={() => window.location.href = '/customers/new'}>
                  Add New Customer
                </Button>
              </Col>
              <Col span={12}>
                <Button block size="large" onClick={() => window.location.href = '/blocks/current'}>
                  View My Blocks
                </Button>
              </Col>
              <Col span={12}>
                <Button block size="large" onClick={() => window.location.href = '/calculator'}>
                  NPV Calculator
                </Button>
              </Col>
              <Col span={12}>
                <Button block size="large" onClick={() => window.location.href = '/reports/monthly'}>
                  Monthly Report
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default SalesRepDashboard