//(function() {
  'use strict';

  const CHAR_PPPP =
    'ABCDEFGHJKLMNPQRSTUVWXYZadefghijmnrty0123456789!#$%&*+-/=><?@\\^~';
  const CHAR_PP7 =
    'あいうえおかきくけこさしすせそたちつてとなにのはひふへほまみむも' +
    'やゆよらりるろをＡＢＣＤＥＦＧＨＩＪＫＬＭＮＰＲＳＴＵＶＷＸＹＺ';

  // フォーマット
  const Format = Object.freeze({
    "PLAIN":0,
    "RLE":2,
  });

  // ルール
  const Rule = Object.freeze({
    "NORMAL":"ノーマル",
    "SUN":"ぷよぷよSUN",
    "MEGA":"でかぷよ",
    "TINY":"ちびぷよ",
  });

  // ぷよとか
  const Puyo = Object.freeze([
    "BLANK",
    "RED",
    "GREEN",
    "BLUE",
    "YELLOW",
    "PURPLE",
    "GARBAGE",
    "SUN",
  ].reduce((instance, identifier, index) => {
    instance[identifier] = index;
    return instance;
  }, {}));

  /**
    * パスワードやセクステットの操作を担うクラス
    *
    * デコード時の基本思想として、簡単に直せる表記揺れは直し、
    * それ以外（ホワイトスペースなど）は無視します。
    */
  class Puyopu64 {
    /**
      * パスワードの表記揺れを統一する
      * @return {String}
      */
    normalizePassword(password) {
      return password;
    }

    /**
      * パスワードをセクステット列にデコードする
      * @return {Array}
      */
    decode(password) {
      const result = [];
      for (const ch of this.normalizePassword(password)) {
        const sextet = this.constructor.passwordChar.indexOf(ch);
        if (sextet < 0) {
          continue;
        }
        result.push(sextet);
      }
      return result;
    }

    /**
      * セクステット列をパスワードにする
      */
    encode(sextetSequence) {
      return this.normalizeSextetSequence(sextetSequence).map(
        String.prototype.charAt.bind(this.constructor.passwordChar)
      ).join('');
    }

    /**
      * セクステット列の正規化（ぷよ７のRLEに使う）
      */
    normalizeSextetSequence(sextetSequence) {
      return sextetSequence;
    }

    /**
      * 指定されたセクステットのフォーマットを取得
      */
    getFormat(sextetSequence) {
      switch(sextetSequence(sextetSequence.length - 1)) {
        case 0:
          return Format.PLAIN;
        case 2:
          return Format.RLE;
        default:
          throw new RangeError('Invalid format.');
      }
    }

    /**
      * あるセクステット列がフィールド何マス分の情報を保持しているか取得
      *
      * 元のフィールド面積が奇数だった場合は偶数に切り上げられます。
      */
    getCellCount(sextetSequence) {
      let size = 0;
      switch (sextetSequence[sextetSequence.length - 1]) {
        case Format.PLAIN:
          return (sextetSequence.length - 1) * 2;
        case Format.RLE:
          let size = 0;
          for (let i = 1; i < sextetSequence.length; i += 2) {
            size += sextetSequence[i] + 1;
          }
          return size * 2;
        default:
          throw new RangeError('Invalid format');
      }
    }

    /**
      * セクステット列の情報量からルールを推測する
      */
    getRuleFromCellCount(sextetSequence) {
      switch(this.getCellCount(sextetSequence)) {
        case 22:
          return Rule.MEGA;
        case 78:
          return Rule.NORMAL;
        case 84:
          return Rule.SUN;
        case 190:
          return Rule.TINY;
        default:
          throw new RangeError('Cannot recognize the original rule.');
      }
    }
  }
  const Puyo20thPassword = new class extends Puyopu64 {
    static passwordChar = CHAR_PP7;

    /**
      * ぷよぷよ！！のパスワード文字の表記揺れを整える
      */
    normalizePassword(password) {
      // パスワードの中の半角英字や小文字を全角英大文字に統一します。
      return password
        .replace(/[A-NPR-Z]/ig, ch =>
          String.fromCharCode(ch.charCodeAt(0) + 0xFEE0))
        .replace(/[ａ-ｎｐｒ-ｚ]/g, ch =>
          String.fromCharCode(ch.charCodeAt(0) - 0x20));
    }
  }();

  const PpppPassword = new class extends Puyopu64 {
    static passwordChar = CHAR_PPPP;

    /**
      * ぷよぷよパズルポップのパスワード文字の表記揺れを整える
      */
    normalizePassword(password) {
      // パスワードの中の全角英数字を半角にします。
      // また、 Shift+^ が半角はチルダで全角は波ダッシュになる環境があるので、
      // ついでに波ダッシュも半角チルダに変換します。
      return password
        .replace(
          /[！＃-＆＊＋－／-９＜-ＨＪ-ＮＰ-Ｚ＼＾ａｄ-ｊｍｎｒｔｙ\uff5e]/g,
          ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
        )
        .replaceAll("\u301C", '~');
    }
  }();

  /**
    * 指定されたパスワードに対応するデコーダーを取得します。
    */
  function getPasswordDecoder(password) {
    let isNotForPuyo20th = false, isNotForPppp = false;

    for (let i = password.length - 1; i >= 0; --i) {
      const ch = password.charAt(i);

      if (!isNotForPuyo20th) {
        const sextetOnPuyo20th =
          Puyo20thPassword.decode(ch)[0];
        if (sextetOnPuyo20th !== undefined) {
          if ([0, 2].includes(sextetOnPuyo20th)) {
            return Puyo20thPassword;
          }
          isNotForPuyo20th = true;
        }
      }

      if (!isNotForPppp) {
        const sextetOnPppp = PpppPassword.decode(ch)[0];
        if (sextetOnPppp !== undefined) {
          if ([0, 2].includes(sextetOnPppp)) {
            return PpppPassword;
          }
          isNotForPppp = true;
        }
      }

      if (isNotForPuyo20th && isNotForPppp) {
        return null;
      }
    }
    return null;
  }

  function isPasswordPuyo7Compatible(password) {
    for (const i = password.length - 1; i >= 0; --i) {
      const ch = password.charAt(i);
      const sextet = CHAR_PP7.indexOf(ch);
    }
  }
//})();
