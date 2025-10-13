-- Migration: Add payment link email template support
-- Description: Creates default payment link email template

-- Note: The 'type' column in reminder_templates is a TEXT column, not an enum
-- So we can directly insert 'payment_link' as a valid type value

-- Create default payment link email template
INSERT INTO reminder_templates (
    name,
    type,
    subject,
    message,
    hours_before,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Payment Request Email',
    'payment_link',
    'Payment Request - {service_name} on {appointment_date}',
    'Hi {customer_name},

Thank you for your recent appointment at {business_name}!

Appointment Details:
• Service: {service_name}
• Date: {appointment_date}
• Time: {appointment_time}
• Amount Due: ${amount_due}

To complete your payment, please click the secure payment link below. You can pay with any major credit card or debit card.

Payment Link: {payment_url}

This payment link is secure and will take you to our payment processor where you can complete your transaction safely.

If you have any questions about this payment or your appointment, please don''t hesitate to contact us at {business_phone}.

Thank you for choosing {business_name}!

Best regards,
The {business_name} Team',
    0, -- hours_before (not applicable for payment links)
    true,
    NOW(),
    NOW()
) ON CONFLICT (type, is_active) DO NOTHING;

-- Verify the template was created
SELECT 
    id,
    name,
    type,
    subject,
    is_active,
    created_at
FROM reminder_templates 
WHERE type = 'payment_link' 
ORDER BY created_at DESC;
