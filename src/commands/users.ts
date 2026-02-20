import { Command, Option } from "commander";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import {
  printError,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

interface AppUser {
  role: string;
  user: {
    id: string;
    auth: { email: string };
    profile: { firstName: string | null; lastName: string | null };
  };
}

interface UserAppConnection {
  app: { id: string; name: string };
  role: string;
}

const USER_FIELDS = `
  user {
    id
    auth { email }
    profile { firstName lastName }
  }
  role
`;

const ROLES = ["ADMIN", "OWNER", "MEMBERS_WRITE", "MEMBERS_READ"];

export const usersCommand = new Command("users")
  .usage("<command> [options]")
  .description("Manage users");

usersCommand
  .command("list")
  .description("List users with access to the app")
  .action(async () => {
    const spinner = yoctoSpinner({ text: "Fetching users..." }).start();
    try {
      const allUsers: AppUser[] = [];
      let cursor: string | undefined;
      const pageSize = 200;

      do {
        const result = await graphqlRequest<{
          getUsers: {
            edges: { cursor: string; node: AppUser }[];
          };
        }>({
          query: `query($first: Int, $after: String) {
  getUsers(first: $first, after: $after) {
    edges { cursor node { ${USER_FIELDS} } }
  }
}`,
          variables: { first: pageSize, after: cursor },
        });

        const { edges } = result.getUsers;
        allUsers.push(...edges.map((e) => e.node));

        if (edges.length === pageSize) {
          cursor = edges.at(-1)?.cursor;
          spinner.text = `Fetching users... (${allUsers.length} so far)`;
        } else {
          cursor = undefined;
        }
      } while (cursor);

      spinner.stop();
      const rows = allUsers.map((u) => ({
        id: u.user.id,
        email: u.user.auth.email,
        firstName: u.user.profile.firstName ?? "",
        lastName: u.user.profile.lastName ?? "",
        role: u.role,
      }));
      printTable(rows);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

usersCommand
  .command("get")
  .description("Get a user by ID or email")
  .argument("<id_or_email>", "User ID or email address")
  .action(async (idOrEmail: string) => {
    const spinner = yoctoSpinner({ text: "Fetching users..." }).start();
    try {
      const result = await graphqlRequest<{
        getUsers: {
          edges: { cursor: string; node: AppUser }[];
        };
      }>({
        query: `query {
  getUsers {
    edges { node { ${USER_FIELDS} } }
  }
}`,
      });
      spinner.stop();

      const isEmail = idOrEmail.includes("@");
      const match = result.getUsers.edges.find((e) =>
        isEmail
          ? e.node.user.auth.email === idOrEmail
          : e.node.user.id === idOrEmail
      );

      if (!match) {
        printError(`User not found: ${idOrEmail}`);
        process.exitCode = 1;
        return;
      }

      printRecord({
        id: match.node.user.id,
        email: match.node.user.auth.email,
        firstName: match.node.user.profile.firstName ?? "",
        lastName: match.node.user.profile.lastName ?? "",
        role: match.node.role,
      });
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

usersCommand
  .command("add")
  .description("Add a user to the app")
  .requiredOption("--email <email>", "Email address of the user to add")
  .addOption(new Option("--role <role>", "Role to assign").choices(ROLES))
  .action(async (opts: { email: string; role?: string }) => {
    const spinner = yoctoSpinner({ text: "Adding user..." }).start();
    try {
      const input: Record<string, unknown> = { email: opts.email };
      if (opts.role) {
        input.role = opts.role;
      }
      const result = await graphqlRequest<{
        addUserToApp: UserAppConnection;
      }>({
        query: `mutation($input: AddUserToAppInput!) {
  addUserToApp(input: $input) {
    app { id name }
    role
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess(`User "${opts.email}" added to app.`);
      printRecord(result.addUserToApp);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

usersCommand
  .command("remove")
  .description("Remove a user from the app")
  .argument("<userId>", "User ID to remove")
  .action(async (userId: string) => {
    const spinner = yoctoSpinner({ text: "Removing user..." }).start();
    try {
      await graphqlRequest<{ removeUserFromApp: UserAppConnection }>({
        query: `mutation($input: RemoveUserFromAppInput!) {
  removeUserFromApp(input: $input) {
    app { id name }
    role
  }
}`,
        variables: { input: { userId } },
      });
      spinner.stop();
      printSuccess(`User "${userId}" removed from app.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

usersCommand
  .command("update-role")
  .description("Update a user's role")
  .argument("<userId>", "User ID to update")
  .addOption(
    new Option("--role <role>", "New role to assign")
      .choices(ROLES)
      .makeOptionMandatory()
  )
  .action(async (userId: string, opts: { role: string }) => {
    const spinner = yoctoSpinner({ text: "Updating user role..." }).start();
    try {
      const result = await graphqlRequest<{
        updateUserRole: UserAppConnection;
      }>({
        query: `mutation($input: UpdateUserRoleInput!) {
  updateUserRole(input: $input) {
    app { id name }
    role
  }
}`,
        variables: { input: { userId, role: opts.role } },
      });
      spinner.stop();
      printSuccess(`User role updated to "${opts.role}".`);
      printRecord(result.updateUserRole);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
