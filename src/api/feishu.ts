import axios from 'axios';

export interface BitableTableConfig {
    appToken: string;
    tableId: string;
    name: string; // User-friendly name for the table
}

export interface FeishuConfig {
    appId: string;
    appSecret: string;
    tables: BitableTableConfig[]; // Multiple table configurations
}

export async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
    const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
    try {
        const response = await axios.post(url, {
            app_id: appId,
            app_secret: appSecret,
        });

        if (response.data.code !== 0) {
            throw new Error(`Feishu API Error: ${response.data.msg} (Code: ${response.data.code})`);
        }

        return response.data.tenant_access_token;
    } catch (error: any) {
        if (error.response?.data) {
            const { code, msg } = error.response.data;
            throw new Error(`Feishu API Error: ${msg || 'Unknown error'} (Code: ${code}, HTTP: ${error.response.status})`);
        }
        throw error;
    }
}

export async function addBitableRecord(
    config: FeishuConfig,
    tableConfig: BitableTableConfig,
    fields: Record<string, any>
): Promise<any> {
    const token = await getTenantAccessToken(config.appId, config.appSecret);
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records`;

    try {
        const response = await axios.post(
            url,
            { fields },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8',
                },
            }
        );

        if (response.data.code !== 0) {
            throw new Error(`Feishu Bitable Error: ${response.data.msg} (Code: ${response.data.code})`);
        }

        return response.data.data;
    } catch (error: any) {
        if (error.response?.data) {
            const { code, msg } = error.response.data;
            throw new Error(`Feishu Bitable Error: ${msg || 'Unknown error'} (Code: ${code}, HTTP: ${error.response.status})`);
        }
        throw error;
    }
}
