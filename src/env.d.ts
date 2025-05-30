// Define the type of the environment variables.
declare interface Env {
    readonly NODE_ENV: string;
    // Replace the following with your own environment variables.
    readonly NG_APP_KEYCLOAK_BASE_URL: string;
    readonly NG_APP_KEYCLOAK_REALM: string;
    readonly NG_APP_KEYCLOAK_CLIENT_ID: string;
    readonly NG_APP_API_URL: string;
    readonly NG_APP_WS_ENDPOINT: string;
}

// Choose how to access the environment variables.
// Remove the unused options.

// 1. Use import.meta.env.YOUR_ENV_VAR in your code. (conventional)
declare interface ImportMeta {
    readonly env: Env;
}

// 2. Use _NGX_ENV_.YOUR_ENV_VAR in your code. (customizable)
// You can modify the name of the variable in angular.json.
// ngxEnv: {
//  define: '_NGX_ENV_',
// }
declare const _NGX_ENV_: Env;
