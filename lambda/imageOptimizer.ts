import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3 } from 'aws-sdk';

const Sharp = require("sharp");
const s3 = new S3();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const imageKey = event.pathParameters?.key;
    const bucketName = process.env.BUCKET_NAME;

    if (!bucketName || !imageKey) {
      console.log("Missing bucket name or image key");
      return {
        statusCode: 400,
        body: "Missing bucket name or image key",
      };
    }

    console.log(`Fetching from ${bucketName} with key ${imageKey}`);

    let originalImage;
    try {
      originalImage = await s3
        .getObject({
          Bucket: bucketName,
          Key: imageKey,
        })
        .promise();
    } catch (e) {
      console.log("Error fetching image from S3:", e);
      return {
        statusCode: 500,
        body: `Error fetching image from S3: ${e}`,
      };
    }

    if (!originalImage.Body) {
      console.log("Image body is empty");
      return {
        statusCode: 404,
        body: "Image not found",
      };
    }

    const width = parseInt(event.queryStringParameters?.width || "200", 10);
    const height = parseInt(event.queryStringParameters?.height || "200", 10);
    const type = event.queryStringParameters?.type || "jpeg";

    let resizedImage;
    try {
      switch (type) {
        case "jpeg":
          resizedImage = await Sharp(originalImage.Body as Buffer)
            .resize(width, height)
            .jpeg()
            .toBuffer();
          break;
        case "png":
          resizedImage = await Sharp(originalImage.Body as Buffer)
            .resize(width, height)
            .png()
            .toBuffer();
          break;
        case "webp":
          resizedImage = await Sharp(originalImage.Body as Buffer)
            .resize(width, height)
            .webp()
            .toBuffer();
          break;
        default:
          resizedImage = await Sharp(originalImage.Body as Buffer)
            .resize(width, height)
            .jpeg()
            .toBuffer();
          break;
      }

      console.log("Resized image", resizedImage);
    } catch (e) {
      console.log("Error resizing image:", e);
      return {
        statusCode: 500,
        body: `Error resizing image: ${e}`,
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Type": `image/${type}`,
        "x-amz-meta-content-type": `image/${type}`,
        "Cache-Control": "max-age=31536000",
        Age: 0,
      },
      body: resizedImage.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.log("General Error:", error);
    return {
      statusCode: 500,
      body: `General error: ${error}`,
    };
  }
};
