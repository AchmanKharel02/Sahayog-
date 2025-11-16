const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send email function
const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'SAHAYOG'}" <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Send bulk emails
const sendBulkEmails = async (emails) => {
  const results = [];
  const transporter = createTransporter();

  for (const email of emails) {
    try {
      const mailOptions = {
        from: `"${process.env.APP_NAME || 'SAHAYOG'}" <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
        to: Array.isArray(email.to) ? email.to.join(', ') : email.to,
        subject: email.subject,
        html: email.html,
        attachments: email.attachments || []
      };

      const info = await transporter.sendMail(mailOptions);
      results.push({ success: true, messageId: info.messageId, to: email.to });
    } catch (error) {
      console.error(`Failed to send email to ${email.to}:`, error);
      results.push({ success: false, error: error.message, to: email.to });
    }
  }

  return results;
};

// Email templates
const emailTemplates = {
  welcome: (user) => ({
    subject: 'Welcome to SAHAYOG!',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4C8BF5; margin: 0;">SAHAYOG</h1>
          <p style="color: #7A7A7A; margin: 5px 0;">Your Gateway to Local Services</p>
        </div>
        <h2 style="color: #2A2D36;">Welcome, ${user.fullName}!</h2>
        <p>Thank you for joining SAHAYOG, Nepal's premier service marketplace.</p>
        <p>With SAHAYOG, you can:</p>
        <ul style="color: #1E1E1E; line-height: 1.6;">
          <li>🔍 Find talented professionals for any task</li>
          <li>💼 Offer your services to thousands of customers</li>
          <li>💰 Manage payments securely through our wallet system</li>
          <li>💬 Communicate with clients in real-time</li>
          <li>⭐ Build your reputation with reviews</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/login" style="background-color: #4C8BF5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Get Started</a>
        </div>
        <p style="color: #7A7A7A; font-size: 14px;">If you have any questions, feel free to contact our support team.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E0E0E0; text-align: center; color: #7A7A7A; font-size: 12px;">
          <p>&copy; 2024 SAHAYOG. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `
  }),

  orderConfirmation: (order, service, buyer, seller) => ({
    subject: `Order Confirmation - ${service.title}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4C8BF5; margin: 0;">Order Confirmed!</h1>
          <p style="color: #7A7A7A; margin: 5px 0;">Order ID: ${order.trackingCode}</p>
        </div>
        <h2 style="color: #2A2D36;">Service Details</h2>
        <div style="background-color: #F8F9FD; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #4C8BF5; margin: 0 0 10px 0;">${service.title}</h3>
          <p><strong>Provider:</strong> ${seller.fullName}</p>
          <p><strong>Price:</strong> NPR ${order.totalAmount.toLocaleString()}</p>
          <p><strong>Expected Delivery:</strong> ${order.expectedDeliveryDate.toLocaleDateString()}</p>
        </div>
        <h3>What's Next?</h3>
        <ol style="color: #1E1E1E; line-height: 1.6;">
          <li>The seller will review your order requirements</li>
          <li>Once accepted, work will begin on your service</li>
          <li>You'll receive notifications throughout the process</li>
          <li>Contact the seller through our chat if needed</li>
        </ol>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/orders/${order._id}" style="background-color: #4C8BF5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Order</a>
        </div>
        <p style="color: #7A7A7A; font-size: 14px;">Need help? Contact our support team.</p>
      </div>
    `
  }),

  paymentReceived: (transaction) => ({
    subject: 'Payment Received - SAHAYOG Wallet',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #03C988; margin: 0;">Payment Received!</h1>
          <p style="color: #7A7A7A; margin: 5px 0;">Your wallet has been credited</p>
        </div>
        <h2 style="color: #2A2D36;">Transaction Details</h2>
        <div style="background-color: #F8F9FD; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Transaction ID:</strong> ${transaction.reference}</p>
          <p><strong>Amount:</strong> NPR ${Math.abs(transaction.amount).toLocaleString()}</p>
          <p><strong>Type:</strong> ${transaction.type}</p>
          <p><strong>Date:</strong> ${transaction.createdAt.toLocaleDateString()}</p>
          <p><strong>Description:</strong> ${transaction.description}</p>
        </div>
        <div style="background-color: #03C988; color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px;"><strong>Current Wallet Balance:</strong> NPR ${transaction.balance.toLocaleString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/wallet" style="background-color: #4C8BF5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Wallet</a>
        </div>
      </div>
    `
  }),

  withdrawalRequest: (withdrawal) => ({
    subject: 'Withdrawal Request Received',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #FF4D4D; margin: 0;">Withdrawal Request</h1>
          <p style="color: #7A7A7A; margin: 5px 0;">Reference: ${withdrawal.reference}</p>
        </div>
        <h2 style="color: #2A2D36;">Request Details</h2>
        <div style="background-color: #F8F9FD; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Amount:</strong> NPR ${withdrawal.amount.toLocaleString()}</p>
          <p><strong>Method:</strong> ${withdrawal.method}</p>
          <p><strong>Net Amount:</strong> NPR ${withdrawal.netAmount.toLocaleString()}</p>
          <p><strong>Requested:</strong> ${withdrawal.requestedAt.toLocaleDateString()}</p>
          <p><strong>Expected Completion:</strong> ${withdrawal.expectedCompletionDate.toLocaleDateString()}</p>
        </div>
        <div style="background-color: #FFF3CD; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Status:</strong> Your request is being reviewed and will be processed within 3 business days.</p>
        </div>
        <p style="color: #7A7A7A; font-size: 14px;">You'll receive notifications about any updates to your withdrawal request.</p>
      </div>
    `
  })
};

// Verify email configuration
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendBulkEmails,
  emailTemplates,
  verifyEmailConfig
};