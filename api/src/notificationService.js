import nodemailer from 'nodemailer'
import { pool } from './db.js'

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
})

// Create in-app notification
export async function createNotification(type, userId, refTable, refId, message) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, ref_table, ref_id, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, refTable, refId, message]
    )

    // Send email notification if configured
    if (process.env.SMTP_USER && userId) {
      await sendEmailNotification(userId, type, message)
    }

    return result.rows[0]
  } catch (error) {
    console.error('Create notification error:', error)
    throw error
  }
}

// Send email notification
async function sendEmailNotification(userId, type, message) {
  try {
    const user = await pool.query('SELECT email FROM users WHERE id = $1', [userId])
    if (user.rows.length === 0) return

    const email = user.rows[0].email
    const subject = getNotificationSubject(type)

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1890ff;">Uptown FS Notification</h2>
          <p>${message}</p>
          <p style="color: #666; font-size: 12px;">
            This is an automated notification from Uptown FS system.
          </p>
        </div>
      `
    })
  } catch (error) {
    console.error('Send email notification error:', error)
  }
}

// Get notification subject based on type
function getNotificationSubject(type) {
  const subjects = {
    offer_submitted: 'New Offer Submitted',
    offer_approved: 'Offer Approved',
    offer_rejected: 'Offer Rejected',
    block_request: 'Unit Block Request',
    block_approved: 'Block Request Approved',
    block_expired: 'Block Expired',
    reservation_created: 'New Reservation Created',
    reservation_approved: 'Reservation Approved',
    contract_ready: 'Contract Ready for Review',
    block_expiry_reminder: 'Block Expiry Reminder'
  }
  return subjects[type] || 'System Notification'
}

// Get user notifications
export async function getUserNotifications(userId, limit = 20, offset = 0) {
  try {
    const notifications = await pool.query(
      `SELECT 
         n.*,
         CASE 
           WHEN n.ref_table = 'offers' THEN o.title
           WHEN n.ref_table = 'blocks' THEN u.code
           WHEN n.ref_table = 'units' THEN un.code
           ELSE NULL
         END as ref_title
       FROM notifications n
       LEFT JOIN offers o ON n.ref_table = 'offers' AND n.ref_id = o.id
       LEFT JOIN blocks b ON n.ref_table = 'blocks' AND n.ref_id = b.id
       LEFT JOIN units u ON n.ref_table = 'blocks' AND b.unit_id = u.id
       LEFT JOIN units un ON n.ref_table = 'units' AND n.ref_id = un.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    // Mark as read
    await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    )

    return notifications.rows
  } catch (error) {
    console.error('Get user notifications error:', error)
    throw error
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId, userId) {
  try {
    await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    )
  } catch (error) {
    console.error('Mark notification as read error:', error)
    throw error
  }
}

// Get unread notification count
export async function getUnreadNotificationCount(userId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    )
    return parseInt(result.rows[0].count, 10)
  } catch (error) {
    console.error('Get unread count error:', error)
    throw error
  }
}

// Create notification for block expiry reminder
export async function createBlockExpiryNotifications() {
  try {
    // Get blocks expiring in next 24 hours
    const expiringBlocks = await pool.query(
      `SELECT 
         b.id,
         b.unit_id,
         b.requested_by,
         u.code as unit_code
       FROM blocks b
       JOIN units u ON b.unit_id = u.id
       WHERE b.status = 'approved' 
         AND b.blocked_until BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
         AND COALESCE(b.expiry_notified, false) = false`
    )

    for (const block of expiringBlocks.rows) {
      await createNotification(
        'block_expiry_reminder',
        block.requested_by,
        'blocks',
        block.id,
        `Block for unit ${block.unit_code} expires in 24 hours`
      )
      // Mark as notified to prevent duplicate notifications
      await pool.query('UPDATE blocks SET expiry_notified = true WHERE id = $1', [block.id])
    }
  } catch (error) {
    console.error('Create block expiry notifications error:', error)
  }
}

// Schedule notification jobs
setInterval(createBlockExpiryNotifications, 60 * 60 * 1000) // Run every hour

export default {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  getUnreadNotificationCount,
  createBlockExpiryNotifications
}