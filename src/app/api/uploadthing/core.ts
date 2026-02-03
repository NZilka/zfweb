/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/only-throw-error */
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { JsonObject } from "@uploadthing/shared";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
//import { db } from "~/server/db";
//import { product } from "~/server/db/schema";
//import { ratelimit } from "~/server/ratelimit";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Product images - allows multiple images per product
  imageUploader: f({
    image: {
      /**
       * For full list of options and defaults, see the File Route API reference
       * @see https://docs.uploadthing.com/file-routes#route-config
       */
      maxFileSize: "8MB",
      maxFileCount: 5, // Supports up to 5 images per product
    },
  })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      // This code runs on your server before upload
      const user = await auth();

      // If you throw, the user will not be able to upload
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      if (!user.userId) throw new UploadThingError("Unauthorized");

      const fullUserData = await (
        await clerkClient()
      ).users.getUser(user.userId);

      if (fullUserData?.privateMetadata?.["can-upload"] !== true)
        throw new UploadThingError("User Does Not Have Upload Permissions");

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: user.userId };
    })

    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload
      console.log("Upload complete for userId:", metadata.userId);

      console.log("file url", file.url);

      type resType = {
        key: string;
        url: string;
      };

      const res: resType = {
        key: file.key,
        url: file.url,
      };
      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { res };
    }),

  // Maintenance mode image - single image only
  maintenanceImageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1, // Only 1 image for maintenance page
    },
  })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      // This code runs on your server before upload
      const user = await auth();

      // If you throw, the user will not be able to upload
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      if (!user.userId) throw new UploadThingError("Unauthorized");

      const fullUserData = await (
        await clerkClient()
      ).users.getUser(user.userId);

      if (fullUserData?.privateMetadata?.["can-upload"] !== true)
        throw new UploadThingError("User Does Not Have Upload Permissions");

      //   const { success } = await ratelimit.limit(user.userId);
      //   if (!success) {
      //     throw new UploadThingError("Rate limit exceeded");
      //   }

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: user.userId };
    })

    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload
      console.log("Upload complete for userId:", metadata.userId);

      console.log("file url", file.url);

      type resType = {
        key: string;
        url: string;
      };

      const res: resType = {
        key: file.key,
        url: file.url,
      };
      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { res };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

// .onUploadComplete(async ({ file }): Promise<void | JsonObject> => {
//   // This code RUNS ON YOUR SERVER after upload
//   //console.log("Upload complete for userId:", metadata.userId);

//   console.log("file url", file.url);

//   const fileJson = {
//     name: file.name,
//     size: file.size,
//     type: file.type,
//     lastModified: file.lastModified,
//     customId: file.customId,
//     key: file.key,
//     url: file.url,
//   };

//   //   await db.insert(product).values({
//   //     utkey: file.key,
//   //     url: file.url,
//   //     name: file.name,
//   //     userId: metadata.userId,
//   //   });

//   // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
//   return { file: fileJson } as JsonObject;
