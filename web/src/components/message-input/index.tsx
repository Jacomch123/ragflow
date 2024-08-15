import { Authorization } from '@/constants/authorization';
import { useTranslate } from '@/hooks/common-hooks';
import {
  useFetchDocumentInfosByIds,
  useRemoveNextDocument,
} from '@/hooks/document-hooks';
import { getAuthorization } from '@/utils/authorization-util';
import { getExtension } from '@/utils/document-util';
import { formatBytes } from '@/utils/file-util';
import { CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { GetProp, UploadFile } from 'antd';
import {
  Button,
  Card,
  Flex,
  Input,
  List,
  Space,
  Spin,
  Typography,
  Upload,
  UploadProps,
} from 'antd';
import classNames from 'classnames';
import get from 'lodash/get';
import { ChangeEventHandler, useCallback, useEffect, useState } from 'react';
import FileIcon from '../file-icon';
import SvgIcon from '../svg-icon';
import styles from './index.less';

type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0];
const { Text } = Typography;

const getFileId = (file: UploadFile) => get(file, 'response.data.0');

const getFileIds = (fileList: UploadFile[]) => {
  const ids = fileList.reduce((pre, cur) => {
    return pre.concat(get(cur, 'response.data', []));
  }, []);

  return ids;
};

interface IProps {
  disabled: boolean;
  value: string;
  sendDisabled: boolean;
  sendLoading: boolean;
  onPressEnter(documentIds: string[]): void;
  onInputChange: ChangeEventHandler<HTMLInputElement>;
  conversationId: string;
  uploadUrl?: string;
}

const getBase64 = (file: FileType): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file as any);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const MessageInput = ({
  disabled,
  value,
  onPressEnter,
  sendDisabled,
  sendLoading,
  onInputChange,
  conversationId,
  uploadUrl = '/v1/document/upload_and_parse',
}: IProps) => {
  const { t } = useTranslate('chat');
  const { removeDocument } = useRemoveNextDocument();
  const { data: documentInfos, setDocumentIds } = useFetchDocumentInfosByIds();

  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj as FileType);
    }
  };

  const handleChange: UploadProps['onChange'] = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };
  const isUploadingFile = fileList.some((x) => x.status === 'uploading');

  const handlePressEnter = useCallback(async () => {
    if (isUploadingFile) return;
    const ids = getFileIds(fileList);

    onPressEnter(ids);
    setFileList([]);
  }, [fileList, onPressEnter, isUploadingFile]);

  const handleRemove = useCallback(
    async (file: UploadFile) => {
      const ids = get(file, 'response.data', []);
      if (ids.length) {
        await removeDocument(ids[0]);
        setFileList((preList) => {
          return preList.filter((x) => getFileId(x) !== ids[0]);
        });
      }
    },
    [removeDocument],
  );

  const getDocumentInfoById = useCallback(
    (id: string) => {
      return documentInfos.find((x) => x.id === id);
    },
    [documentInfos],
  );

  useEffect(() => {
    const ids = getFileIds(fileList);
    setDocumentIds(ids);
  }, [fileList, setDocumentIds]);

  return (
    <Flex gap={20} vertical className={styles.messageInputWrapper}>
      <Input
        size="large"
        placeholder={t('sendPlaceholder')}
        value={value}
        disabled={disabled}
        className={classNames({ [styles.inputWrapper]: fileList.length === 0 })}
        suffix={
          <Space>
            {conversationId && (
              <Upload
                action={uploadUrl}
                fileList={fileList}
                onPreview={handlePreview}
                onChange={handleChange}
                multiple
                headers={{ [Authorization]: getAuthorization() }}
                data={{ conversation_id: conversationId }}
                method="post"
                onRemove={handleRemove}
                showUploadList={false}
              >
                <Button
                  type={'text'}
                  icon={
                    <SvgIcon name="paper-clip" width={18} height={22}></SvgIcon>
                  }
                ></Button>
              </Upload>
            )}
            <Button
              type="primary"
              onClick={handlePressEnter}
              loading={sendLoading}
              disabled={sendDisabled || isUploadingFile}
            >
              {t('send')}
            </Button>
          </Space>
        }
        onPressEnter={handlePressEnter}
        onChange={onInputChange}
      />

      {fileList.length > 0 && (
        <List
          grid={{
            gutter: 16,
            xs: 1,
            sm: 1,
            md: 1,
            lg: 1,
            xl: 2,
            xxl: 4,
          }}
          dataSource={fileList}
          className={styles.listWrapper}
          renderItem={(item) => {
            const fileExtension = getExtension(item.name);
            const id = getFileId(item);

            return (
              <List.Item>
                <Card className={styles.documentCard}>
                  <Flex gap={10} align="center">
                    {item.status === 'uploading' || !item.response ? (
                      <Spin
                        indicator={
                          <LoadingOutlined style={{ fontSize: 24 }} spin />
                        }
                      />
                    ) : (
                      <FileIcon id={id} name={item.name}></FileIcon>
                    )}
                    <Flex vertical style={{ width: '90%' }}>
                      <Text
                        ellipsis={{ tooltip: item.name }}
                        className={styles.nameText}
                      >
                        <b> {item.name}</b>
                      </Text>
                      {item.percent !== 100 ? (
                        t('uploading')
                      ) : !item.response ? (
                        t('parsing')
                      ) : (
                        <Space>
                          <span>{fileExtension?.toUpperCase()},</span>
                          <span>
                            {formatBytes(getDocumentInfoById(id)?.size ?? 0)}
                          </span>
                        </Space>
                      )}
                    </Flex>
                  </Flex>

                  {item.status !== 'uploading' && (
                    <CloseCircleOutlined
                      className={styles.deleteIcon}
                      onClick={() => handleRemove(item)}
                    />
                  )}
                </Card>
              </List.Item>
            );
          }}
        />
      )}
    </Flex>
  );
};

export default MessageInput;