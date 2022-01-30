import { APIGatewayProxyHandler } from "aws-lambda"
import { document } from '../utils/dynamodbClient'
import { compile } from 'handlebars'
import { join } from 'path'
import { readFileSync } from 'fs'
import dayjs from 'dayjs'
import chromium from 'chrome-aws-lambda'
import { S3 } from 'aws-sdk'

interface ICreateCertificate {
    id: string
    name: string
    grade: string
    medal?: string
    date?: string
}

async function compileTemplate(data: ICreateCertificate) {
    const path = join(process.cwd(), 'src', 'templates', 'certificate.hbs')
    const html = readFileSync(path, 'utf8')
    return compile(html)(data)
}

export const handler: APIGatewayProxyHandler = async (event) => {
    const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate

    const response = await document
    .query({
        TableName: 'usersCertificate',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
            ':id': id
        }
    }).promise()
    const userAlreadyExists = response.Items[0]

    if(!userAlreadyExists){
        await document.put({
            TableName: 'usersCertificate',
            Item: {
                id,
                name, 
                grade,
                createdAt: new Date().getTime(),
            }
        }).promise()
    }

    const medalPath = join(process.cwd(), 'src', 'templates', 'selo.png')
    const medal = readFileSync(medalPath, 'base64')

    const data: ICreateCertificate = {
        name,
        id,
        grade,
        date: dayjs().format('DD/MM/YYYY'),
        medal
    }

    const content = await compileTemplate(data)

    const browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
    })
    const page = await browser.newPage()
    await page.setContent(content)

    const pdf = await page.pdf({
        format: 'a4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        path: process.env.IS_OFFLINE ? './files/certificate.pdf' : null
    })

    await browser.close()

    const s3 = new S3()

    await s3.putObject({
        Bucket: 'certificates-serverless',
        Key: `${id}.pdf`,
        ACL: 'public-read',
        Body: pdf,
        ContentType: 'application/pdf'
    }).promise()

    return {
        statusCode: 201,
        body: JSON.stringify({
            message: 'Certificate generated successfully!',
            url: `https://certificates-serverless.s3.sa-east-1.amazonaws.com/${id}.pdf`
        })
    }
}