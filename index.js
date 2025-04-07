
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const fetch = require("node-fetch");
const twilio = require("twilio");
require("dotenv").config();

admin.initializeApp();

const dbxToken = process.env.DROPBOX_TOKEN;
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const twilioPhone = process.env.TWILIO_PHONE;
const alertRecipient = process.env.ALERT_PHONE;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.uploadFile = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  const { filename, filecontent, sender } = req.body;

  try {
    const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + dbxToken,
        "Dropbox-API-Arg": JSON.stringify({
          path: "/Context Weaver™/" + filename,
          mode: "add",
          autorename: true,
          mute: false
        }),
        "Content-Type": "application/octet-stream"
      },
      body: Buffer.from(filecontent, 'base64')
    });

    if (!response.ok) throw new Error("Dropbox upload failed.");

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "michael@contextweaver.ai",
      subject: "Investor File Upload Received",
      text: `File uploaded: ${filename} from ${sender}`
    });

    await twilioClient.messages.create({
      body: `Investor upload received: ${filename}`,
      from: twilioPhone,
      to: alertRecipient
    });

    res.status(200).send("Upload routed successfully.");
  } catch (err) {
    res.status(500).send("Upload failed: " + err.message);
  }
});

exports.sendMessage = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  const { email, message } = req.body;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "michael@contextweaver.ai",
      subject: "Investor Message Received",
      text: `Message from ${email}: ${message}`
    });

    await twilioClient.messages.create({
      body: `Investor message received from ${email}`,
      from: twilioPhone,
      to: alertRecipient
    });

    res.status(200).send("Message sent.");
  } catch (err) {
    res.status(500).send("Message failed: " + err.message);
  }
});
