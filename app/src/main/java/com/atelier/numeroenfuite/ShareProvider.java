package com.atelier.numeroenfuite;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * V9.18 : donne aux applications de partage (messagerie, galerie…) l'accès en LECTURE SEULE à l'image de
 * victoire que le jeu vient de créer, et à rien d'autre. Sans bibliothèque externe (pas d'AndroidX).
 * Non exporté : l'accès n'est accordé qu'au moment du partage (FLAG_GRANT_READ_URI_PERMISSION).
 */
public final class ShareProvider extends ContentProvider {

    static final String FILE_NAME = "victoire.png";

    static File shareFile(android.content.Context c) {
        return new File(new File(c.getCacheDir(), "share"), FILE_NAME);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!FILE_NAME.equals(uri.getLastPathSegment()) || getContext() == null) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(shareFile(getContext()), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return "image/png";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        if (getContext() == null) return null;
        File f = shareFile(getContext());
        MatrixCursor c = new MatrixCursor(new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE });
        c.addRow(new Object[] { FILE_NAME, f.length() });
        return c;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] args) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) {
        return 0;
    }
}
