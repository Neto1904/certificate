import { APIGatewayProxyHandler } from "aws-lambda"
import { document } from '../utils/dynamodbClient'




export const handler: APIGatewayProxyHandler = async (event) => {
    const { id } = event.pathParameters

    const response = await document
    .query({
        TableName: 'usersCertificate',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
            ':id': id
        }
    }).promise()

    const userCertificate = response.Items[0]

    if (userCertificate) {
        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'Valid certificate!',
                name: userCertificate.name,
                url: `https://certificates-serverless.s3.sa-east-1.amazonaws.com/${id}.pdf`
            })
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: 'Invalid certificate!'
        })
    }
}