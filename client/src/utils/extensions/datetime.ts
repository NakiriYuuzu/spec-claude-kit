/**
 * 將日期轉換為民國年格式
 * @param date 要轉換的日期
 * @param format 輸出格式，預設為 'yyy/MM/dd'
 * @param includeSuffix 是否顯示「民國」前綴
 * @returns 民國年日期字串
 */
export function toRocDate(date: Date, format: string = 'yyy/MM/dd', includeSuffix: boolean = false): string {
    try {
        // 獲取民國年
        const rocYear = date.getFullYear() - 1911;

        // 處理負數年份（民國前）
        const yearString = rocYear < 0 ? `-${Math.abs(rocYear)}` : `${rocYear}`;

        // 根據格式替換年份部分
        let result: string;
        if (format.includes('yyyy')) {
            // 4位數年份
            result = format.replace('yyyy', yearString.padStart(4, '0'));
        } else if (format.includes('yyy')) {
            // 3位數年份（標準民國年格式）
            result = format.replace('yyy', yearString.padStart(3, '0'));
        } else if (format.includes('yy')) {
            // 2位數年份
            const shortYear = rocYear % 100;
            result = format.replace('yy', String(shortYear).padStart(2, '0'));
        } else if (format.includes('y')) {
            // 1位數年份
            result = format.replace('y', yearString);
        } else {
            // 默認使用3位數年份
            result = `${yearString.padStart(3, '0')}${format}`;
        }

        // 替換月份和日期
        const month = date.getMonth() + 1;
        const day = date.getDate();

        result = result
            .replace('MM', String(month).padStart(2, '0'))
            .replace('M', String(month))
            .replace('dd', String(day).padStart(2, '0'))
            .replace('d', String(day));

        // 添加「民國」前綴
        if (includeSuffix) {
            result = `民國${result}`;
        }

        return result;
    } catch (error) {
        throw new Error(`日期轉換錯誤: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 將民國年格式的字符串轉換為Date對象
 * @param rocDateString 民國年日期字符串 (例如: "111/01/01" 或 "民國111年01月01日")
 * @returns Date對象
 */
export function fromRocDate(rocDateString: string): Date {
    try {
        // 移除「民國」前綴
        let cleanString = rocDateString.replace('民國', '');

        // 嘗試提取年月日
        let year: number, month: number, day: number;

        // 處理 yyy/MM/dd 格式
        let matches = cleanString.match(/^(\d+)\/(\d+)\/(\d+)$/);
        if (matches) {
            year = parseInt(matches[1], 10) + 1911;
            month = parseInt(matches[2], 10) - 1; // JavaScript的月份從0開始
            day = parseInt(matches[3], 10);
            return new Date(year, month, day);
        }

        // 處理 yyy-MM-dd 格式
        matches = cleanString.match(/^(\d+)-(\d+)-(\d+)$/);
        if (matches) {
            year = parseInt(matches[1], 10) + 1911;
            month = parseInt(matches[2], 10) - 1;
            day = parseInt(matches[3], 10);
            return new Date(year, month, day);
        }

        // 處理 yyy年MM月dd日 格式
        matches = cleanString.match(/^(\d+)年(\d+)月(\d+)日$/);
        if (matches) {
            year = parseInt(matches[1], 10) + 1911;
            month = parseInt(matches[2], 10) - 1;
            day = parseInt(matches[3], 10);
            return new Date(year, month, day);
        }

        // 嘗試其他可能的格式...

        throw new Error(`不支持的日期格式: ${rocDateString}`);
    } catch (error) {
        throw new Error(`民國年日期轉換錯誤: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 檢查字符串是否為有效的民國年日期
 * @param rocDateString 民國年日期字符串
 * @returns 是否有效
 */
export function isValidRocDate(rocDateString: string): boolean {
    try {
        const date = fromRocDate(rocDateString);
        return !isNaN(date.getTime());
    } catch {
        return false;
    }
}
