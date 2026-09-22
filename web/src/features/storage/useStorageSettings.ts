import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { storageClient } from "@/data/rpc/clients";
import { errorText } from "@/data/rpc/errors";

export type MigrationProgress = {
    done: number;
    total: number;
    skipped: number;
};

export function useStorageSettings() {
    const { t } = useTranslation();
    const [endpoint, setEndpoint] = useState("");
    const [region, setRegion] = useState("");
    const [bucket, setBucket] = useState("");
    const [accessKey, setAccessKey] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [configured, setConfigured] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [pending, setPending] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testMsg, setTestMsg] = useState<string | null>(null);
    const [progress, setProgress] = useState<MigrationProgress | null>(null);
    const [migrating, setMigrating] = useState(false);
    const [migrateDone, setMigrateDone] = useState(false);

    useEffect(() => {
        void (async () => {
            try {
                const resp = await storageClient.getStorageConfig({});
                if (resp.config) {
                    setEndpoint(resp.config.endpoint);
                    setRegion(resp.config.region);
                    setBucket(resp.config.bucket);
                    setConfigured(true);
                    setPending(resp.config.pendingMigration);
                }
            } finally {
                setLoaded(true);
            }
        })();
    }, []);

    const runMigration = async () => {
        setMigrating(true);
        setMigrateDone(false);
        setError(null);
        setProgress(null);
        try {
            for await (const frame of storageClient.migrateArchives({})) {
                setProgress({
                    done: frame.done,
                    total: frame.total,
                    skipped: frame.skipped,
                });
                // Migration failures arrive in-band on the final frame
                // rather than as a stream error.
                if (frame.finished) {
                    if (frame.error) {
                        setError(frame.error);
                    } else {
                        setMigrateDone(true);
                        setPending(false);
                    }
                }
            }
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setMigrating(false);
        }
    };

    const handleSave = async () => {
        setBusy(true);
        setError(null);
        setTestMsg(null);
        try {
            const resp = await storageClient.updateStorageConfig({
                endpoint,
                region,
                bucket,
                accessKey,
                secretKey,
            });
            setConfigured(true);
            setPending(resp.config?.pendingMigration ?? false);
            if (resp.migrationTotal > 0) {
                setProgress({
                    done: 0,
                    total: resp.migrationTotal,
                    skipped: 0,
                });
                void runMigration();
            }
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    const handleTest = async () => {
        setBusy(true);
        setError(null);
        setTestMsg(null);
        try {
            await storageClient.testStorageConfig({
                endpoint,
                region,
                bucket,
                accessKey,
                secretKey,
            });
            setTestMsg(t("storage.testOk"));
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(t("storage.deleteConfirm"))) return;
        setBusy(true);
        setError(null);
        try {
            await storageClient.deleteStorageConfig({});
            setConfigured(false);
            setEndpoint("");
            setRegion("");
            setBucket("");
            setAccessKey("");
            setSecretKey("");
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    return {
        endpoint,
        setEndpoint,
        region,
        setRegion,
        bucket,
        setBucket,
        accessKey,
        setAccessKey,
        secretKey,
        setSecretKey,
        configured,
        loaded,
        pending,
        busy,
        error,
        testMsg,
        progress,
        migrating,
        migrateDone,
        runMigration,
        handleSave,
        handleTest,
        handleDelete,
    };
}
