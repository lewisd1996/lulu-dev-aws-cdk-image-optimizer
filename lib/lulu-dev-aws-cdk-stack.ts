import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class ImageOptimizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imageBucket = new s3.Bucket(this, "MyImageBucket", {
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for dev/test envs!
      autoDeleteObjects: true, // Automatically delete objects upon bucket removal,
      cors: [
        {
          maxAge: 3000,
          allowedOrigins: ["*"], // for production, specify your domain instead of '*'
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
        },
      ],
    });

    const bucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:PutObject", "s3:GetObject"],
      resources: [`${imageBucket.bucketArn}/*`],
      principals: [new iam.AnyPrincipal()],
    });

    imageBucket.addToResourcePolicy(bucketPolicy);

    // Lambda for on the fly image optimization
    const imageOptimizer = new lambdaNodeJs.NodejsFunction(
      this,
      "ImageOptimizerLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: "lambda/imageOptimizer.ts",
        handler: "handler",
        environment: {
          BUCKET_NAME: imageBucket.bucketName,
        },
        bundling: {
          nodeModules: ["sharp"],
        },
      }
    );

    // Allow Lambda to read from our S3 bucket
    imageBucket.grantRead(imageOptimizer);

    // API Gateway for image optimization
    const api = new apigateway.RestApi(this, "ImageOptimizerApi", {
      restApiName: "Image Optimizer Service",
      deployOptions: {
        stageName: "dev", // Replace with your desired stage name
        loggingLevel: apigateway.MethodLoggingLevel.INFO, // or ERROR
        dataTraceEnabled: true,
      },
      binaryMediaTypes: ["image/jpeg", "image/png", "text/html", "image/webp"],
    });

    const optimize = api.root.addResource("optimize");
    const imageResource = optimize.addResource("{key+}");

    const lambdaIntegration = new apigateway.LambdaIntegration(imageOptimizer);
    imageResource.addMethod("GET", lambdaIntegration);
  }
}
