// const nodemailer = require('nodemailer');

import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
    secure:true,
    host: 'smtp.gmail.com',
    port:465,
    auth: {
        user: 'sureshk28561@gmail.com',
        pass: 'snjtuuttrrfbjjld',
    },
});

export function sendMail(to, subject, message) {
    try{
    transporter.sendMail({
        to:to,
        subject:subject,
        html:message
    });
    console.log("Email sent!");
}catch(error){
    console.log("Email is not sent\n",error);
}
}

//sendMail("sureshk28591@gmail.com","To Test Nodemailer","This is Suresh");
